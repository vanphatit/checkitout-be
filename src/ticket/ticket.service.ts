import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import {
  Ticket,
  TicketDocument,
  TicketSnapshot,
} from './entities/ticket.entity';
import { TicketStatus } from './enums/ticket-status.enum';
import { SeatService } from '../seat/seat.service';
import {
  Scheduling,
  SchedulingDocument,
} from '../scheduling/entities/scheduling.entity';
import { Route, RouteDocument } from '../route/entities/route.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { UserActivityService } from '../users/user-activity.service';
import { UserActivityAction } from '../users/enums/user-activity-action.enum';
import { PromotionService } from '../promotion/promotion.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { SeatStatus } from '../seat/enums/seat-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { VNPayService } from '../vnpay/vnpay.service';
import { Seat } from '../seat/entities/seat.entity';
import { Promotion } from '../promotion/entities/promotion.entity';

// Type helper for populated ticket documents
type TicketPopulated = TicketDocument & {
  userId: UserDocument;
  seatId: Seat & { _id: Types.ObjectId };
  schedulingId: SchedulingDocument;
  promotionId?: Promotion & { _id: Types.ObjectId };
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Scheduling.name)
    private schedulingModel: Model<SchedulingDocument>,
    @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly seatService: SeatService,
    private readonly promotionService: PromotionService,
    private readonly vnpayService: VNPayService,
    private readonly userActivityService: UserActivityService,
  ) {}

  // ============================================
  // BUILD SNAPSHOT - Core Logic
  // ============================================
  private async buildSnapshot(
    seatId: Types.ObjectId,
    schedulingId: Types.ObjectId,
    promotionId: Types.ObjectId,
    totalPrice: number,
  ): Promise<TicketSnapshot> {
    const [seat, scheduling, promotion] = await Promise.all([
      this.seatService.getSeatForSnapshot(seatId.toString()),
      this.schedulingModel.findById(schedulingId).lean().exec(),
      this.promotionService.findOne(promotionId.toString()),
    ]);

    if (!seat || !scheduling || !promotion) {
      throw new NotFoundException('Related data not found for snapshot');
    }

    if (scheduling.price === undefined || scheduling.price === null) {
      throw new BadRequestException('Scheduling must have price for snapshot');
    }

    const route = await this.routeModel
      .findById(scheduling.routeId)
      .populate('stationIds', 'name')
      .lean();

    if (!route || !route.stationIds?.length) {
      throw new BadRequestException('Invalid route data');
    }

    type PopulatedStation = { _id: Types.ObjectId; name: string };
    const stations = route.stationIds as unknown as PopulatedStation[];
    const fromStation = stations[0];
    const toStation = stations[stations.length - 1];

    const originalPrice = scheduling.price;
    const discountAmount = this.promotionService.calculateDiscount(
      originalPrice,
      promotion.value,
    );

    const snapshot: TicketSnapshot = {
      seat: {
        seatId: (seat._id as Types.ObjectId).toString(),
        seatNo: seat.seatNo,
        busId: seat.busId.toString(),
      },
      scheduling: {
        schedulingId: (scheduling._id as Types.ObjectId).toString(),
        departureDate: scheduling.departureDate,
        arrivalDate: scheduling.arrivalDate || scheduling.departureDate,
        price: scheduling.price,
        busId: scheduling.busId.toString(),
      },
      route: {
        routeId: (route._id as Types.ObjectId).toString(),
        name: route.name,
        from: {
          stationId: fromStation._id.toString(),
          name: fromStation.name,
        },
        to: {
          stationId: toStation._id.toString(),
          name: toStation.name,
        },
        distance: route.distance ?? 0,
        etd: route.etd,
      },
      promotion: {
        promotionId: promotion._id.toString(),
        name: promotion.name,
        value: promotion.value,
        type: promotion.type,
        description: promotion.description,
      },
      pricing: {
        originalPrice,
        promotionValue: promotion.value,
        discountAmount,
        finalPrice: totalPrice,
      },
      snapshotCreatedAt: new Date(),
    };

    return snapshot;
  }

  // ============================================
  // CREATE TICKET (using phone with auto-user-creation)
  // ============================================
  async create(dto: CreateTicketDto) {
    // 1. Find or create user by phone (atomic operation using upsert)
    const user = await this.userModel
      .findOneAndUpdate(
        { phone: dto.phone },
        {
          $setOnInsert: {
            phone: dto.phone,
            firstName: dto.firstName || 'Guest',
            lastName: dto.lastName || 'Customer',
            status: UserStatus.PRE_REGISTERED,
            role: UserRole.CUSTOMER,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (!user) {
      throw new BadRequestException('Failed to create or find user');
    }

    // Log activity if user was just created (createdAt within last 2 seconds)
    const activityCheckTime = new Date();
    const userCreatedAt =
      user.createdAt instanceof Date
        ? user.createdAt
        : new Date(user.createdAt!);
    const timeDiff = activityCheckTime.getTime() - userCreatedAt.getTime();
    const userId = (user._id as any).toString();

    if (timeDiff < 2000) {
      // User was just created (within last 2 seconds)
      await this.userActivityService.logUserActivity(
        userId,
        UserActivityAction.ACCOUNT_CREATED,
        {
          performedBy: userId,
          description: 'User account auto-created when ticket was booked',
          metadata: {
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            status: UserStatus.PRE_REGISTERED,
            role: UserRole.CUSTOMER,
            source: 'ticket_booking',
          },
        },
      );
    }

    // 2. Get and validate scheduling
    const scheduling = await this.schedulingModel
      .findById(dto.schedulingId)
      .exec();
    if (!scheduling) {
      throw new NotFoundException('Scheduling not found');
    }
    if (!scheduling.price) {
      throw new BadRequestException(
        'Scheduling does not have price information',
      );
    }

    // 3. Validate scheduling is in the future
    const now = new Date();
    if (scheduling.departureDate <= now) {
      throw new BadRequestException('Cannot book ticket for past scheduling');
    }

    // 4. Calculate expired time (3 hours before departure)
    const expiredTime = new Date(scheduling.departureDate);
    expiredTime.setHours(expiredTime.getHours() - 3);

    if (expiredTime <= now) {
      throw new BadRequestException(
        'Cannot book ticket: departure time is too soon (less than 3 hours from now)',
      );
    }

    // 5. Check seat availability
    await this.seatService.checkSeatAvailability(
      dto.seatId,
      scheduling.busId.toString(),
    );

    // 6. Find applicable promotion
    const promotion = await this.promotionService.findApplicablePromotion(
      scheduling.departureDate,
    );

    // 7. Calculate final price
    const totalPrice = this.promotionService.calculateFinalPrice(
      scheduling.price,
      promotion.value,
    );

    // 8. Set default paymentMethod if missing
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.BANKING;

    // 9. Create ticket
    const ticket = new this.ticketModel({
      userId: user._id,
      seatId: new Types.ObjectId(dto.seatId),
      schedulingId: new Types.ObjectId(dto.schedulingId),
      promotionId: promotion._id as Types.ObjectId,
      paymentMethod,
      fallbackURL: dto.fallbackURL,
      totalPrice,
      expiredTime,
      status: TicketStatus.PENDING,
      snapshot: null,
    });

    const savedTicket = await ticket.save();

    // 10. Reserve seat
    await this.seatService.reserveSeat(dto.seatId, scheduling.busId.toString());

    return this.ticketModel
      .findById(savedTicket._id)
      .populate('userId', 'firstName lastName email phone')
      .populate('seatId', 'seatNo status')
      .populate('schedulingId')
      .populate('promotionId', 'name value type description')
      .exec();
  }

  // ============================================
  // UPDATE STATUS (with paymentMethod update)
  // ============================================
  async updateStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) throw new NotFoundException('Ticket not found');

    this.validateStatusTransition(ticket.status, dto.status);

    // Validate expiry for SUCCESS transition
    if (
      dto.status === TicketStatus.SUCCESS &&
      ticket.status === TicketStatus.PENDING
    ) {
      const now = new Date();
      if (now > ticket.expiredTime) {
        throw new BadRequestException('Cannot confirm: ticket has expired');
      }
    }

    // Create snapshot when status becomes final
    const shouldCreateSnapshot =
      dto.status === TicketStatus.SUCCESS || dto.status === TicketStatus.FAILED;

    if (shouldCreateSnapshot && !ticket.snapshot) {
      ticket.snapshot = await this.buildSnapshot(
        ticket.seatId,
        ticket.schedulingId,
        ticket.promotionId,
        ticket.totalPrice,
      );
    }

    // Update ticket
    ticket.status = dto.status;
    if (dto.fallbackURL) {
      ticket.fallbackURL = dto.fallbackURL;
    }

    // Update paymentMethod if provided (for CASH payment)
    if (dto.paymentMethod) {
      ticket.paymentMethod = dto.paymentMethod;
    }

    await ticket.save();

    // Update seat status
    if (dto.status === TicketStatus.SUCCESS) {
      await this.seatService.confirmSeat(ticket.seatId.toString());
    } else if (dto.status === TicketStatus.FAILED) {
      await this.seatService.releaseSeat(ticket.seatId.toString());
    }

    return this.findOne(id);
  }

  // ============================================
  // TRANSFER TICKET (with restrictions)
  // ============================================
  async transfer(oldTicketId: string, dto: TransferTicketDto) {
    // 1. Get old ticket with populated data for description
    const oldTicket = await this.ticketModel
      .findById(oldTicketId)
      .populate('schedulingId')
      .populate('seatId', 'seatNo')
      .populate('userId', 'firstName lastName email')
      .exec();

    if (!oldTicket) throw new NotFoundException('Old ticket not found');

    // Only SUCCESS tickets can be transferred
    if (oldTicket.status !== TicketStatus.SUCCESS) {
      throw new BadRequestException(
        'Can only transfer confirmed (SUCCESS) tickets',
      );
    }

    // Check if ticket has already been transferred
    if (oldTicket.transferTicketId) {
      throw new BadRequestException(
        'This ticket has already been transferred. Each ticket can only be transferred once.',
      );
    }

    const oldScheduling = oldTicket.schedulingId as any;
    if (!oldScheduling) throw new NotFoundException('Old scheduling not found');

    // 3. Check if transfer is allowed (at least 3 hours before departure)
    const now = new Date();
    const threeHoursBefore = new Date(oldScheduling.departureDate);
    threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);

    if (now >= threeHoursBefore) {
      throw new BadRequestException(
        'Cannot transfer ticket: must be at least 3 hours before departure',
      );
    }

    // 4. Get new scheduling
    const newScheduling = await this.schedulingModel
      .findById(dto.newSchedulingId)
      .exec();
    if (!newScheduling) throw new NotFoundException('New scheduling not found');
    if (!newScheduling.price) {
      throw new BadRequestException(
        'New scheduling does not have price information',
      );
    }

    // 5. Validate same route and price
    if (oldScheduling.routeId.toString() !== newScheduling.routeId.toString()) {
      throw new BadRequestException('Transfer must be on the same route');
    }
    if (oldScheduling.price !== newScheduling.price) {
      throw new BadRequestException('Transfer requires same price');
    }

    // 6. Check new seat availability
    await this.seatService.checkSeatAvailability(
      dto.newSeatId,
      newScheduling.busId.toString(),
    );

    // 7. Find applicable promotion for new scheduling
    const promotion = await this.promotionService.findApplicablePromotion(
      newScheduling.departureDate,
    );

    // 8. Calculate new price and expired time
    const totalPrice = this.promotionService.calculateFinalPrice(
      newScheduling.price,
      promotion.value,
    );

    const expiredTime = new Date(newScheduling.departureDate);
    expiredTime.setHours(expiredTime.getHours() - 3);

    // 9. Create snapshot for new ticket
    const newTicketSnapshot = await this.buildSnapshot(
      new Types.ObjectId(dto.newSeatId),
      new Types.ObjectId(dto.newSchedulingId),
      promotion._id as Types.ObjectId,
      totalPrice,
    );

    //  10. Generate transfer description
    const oldSeat = oldTicket.seatId as any;
    const oldUser = oldTicket.userId as any;
    const transferDescription = dto.reason
      ? `Transferred from ticket #${oldTicketId} (Seat ${oldSeat?.seatNo}, Departure: ${new Date(oldScheduling.departureDate).toLocaleString()}). Reason: ${dto.reason}`
      : `Transferred from ticket #${oldTicketId} (Seat ${oldSeat?.seatNo}, Departure: ${new Date(oldScheduling.departureDate).toLocaleString()}, Customer: ${oldUser?.email})`;

    // 11. Create new ticket
    const newTicket = new this.ticketModel({
      userId: oldTicket.userId,
      seatId: new Types.ObjectId(dto.newSeatId),
      schedulingId: new Types.ObjectId(dto.newSchedulingId),
      promotionId: promotion._id as Types.ObjectId,
      paymentMethod: oldTicket.paymentMethod,
      fallbackURL: oldTicket.fallbackURL,
      totalPrice,
      expiredTime,
      status: TicketStatus.SUCCESS,
      snapshot: newTicketSnapshot,
      transferDescription, // Add description
    });

    const savedNewTicket = await newTicket.save();

    // 12. Create snapshot for old ticket if not exists
    if (!oldTicket.snapshot) {
      oldTicket.snapshot = await this.buildSnapshot(
        oldTicket.seatId,
        oldTicket.schedulingId,
        oldTicket.promotionId,
        oldTicket.totalPrice,
      );
    }

    // 13. Update old ticket status and link to new ticket
    oldTicket.status = TicketStatus.TRANSFER;
    oldTicket.transferTicketId = savedNewTicket._id as Types.ObjectId;
    await oldTicket.save();

    // 14. Update seat statuses
    await Promise.all([
      this.seatService.releaseSeat((oldTicket.seatId as any)._id.toString()),
      this.seatService.updateSeatStatus(dto.newSeatId, SeatStatus.SOLD),
    ]);

    return {
      oldTicket: await this.findOne(oldTicketId),
      newTicket: await this.findOne(
        (savedNewTicket._id as Types.ObjectId).toString(),
      ),
      message: 'Ticket transferred successfully',
      transferDescription,
    };
  }
  // ============================================
  // CANCEL EXPIRED TICKETS
  // ============================================
  async cancelExpiredTickets() {
    const now = new Date();

    const expiredTickets = await this.ticketModel
      .find({
        status: TicketStatus.PENDING,
        expiredTime: { $lte: now },
      })
      .exec();

    const results: Types.ObjectId[] = [];
    const seatIdsToRelease: string[] = [];

    for (const ticket of expiredTickets) {
      if (!ticket.snapshot) {
        ticket.snapshot = await this.buildSnapshot(
          ticket.seatId,
          ticket.schedulingId,
          ticket.promotionId,
          ticket.totalPrice,
        );
      }

      ticket.status = TicketStatus.FAILED;
      await ticket.save();

      seatIdsToRelease.push(ticket.seatId.toString());
      results.push(ticket._id as Types.ObjectId);
    }

    if (seatIdsToRelease.length > 0) {
      await this.seatService.releaseSeats(seatIdsToRelease);
    }

    return {
      message: `Cancelled ${expiredTickets.length} expired tickets`,
      count: expiredTickets.length,
      ticketIds: results,
    };
  }

  // ============================================
  // MANUAL FAIL TICKET
  // ============================================
  async failTicket(id: string, reason?: string) {
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.PENDING) {
      throw new BadRequestException('Can only fail PENDING tickets');
    }

    if (!ticket.snapshot) {
      ticket.snapshot = await this.buildSnapshot(
        ticket.seatId,
        ticket.schedulingId,
        ticket.promotionId,
        ticket.totalPrice,
      );
    }

    ticket.status = TicketStatus.FAILED;
    await ticket.save();

    await this.seatService.releaseSeat(ticket.seatId.toString());

    return {
      ticket: await this.findOne(id),
      message: `Ticket failed: ${reason || 'Manual cancellation'}`,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  async findOne(id: string) {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('userId', 'firstName lastName email phone')
      .populate('seatId', 'seatNo status')
      .populate('schedulingId')
      .populate('promotionId', 'name value type description')
      .populate('transferTicketId')
      .exec();

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async findAll(query: TicketQueryDto): Promise<PaginatedResult<Ticket>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      email,
      phone,
      schedulingId,
      status,
      paymentMethod,
      fromDate,
      toDate,
    } = query;

    const filter: any = {};

    // Filter by email OR phone if provided
    if (email || phone) {
      const userQuery: any = {};
      if (email) userQuery.email = email;
      if (phone) userQuery.phone = phone;

      const users = await this.userModel.find(userQuery).select('_id').exec();

      if (users.length === 0) {
        // If no users match, return empty result
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        };
      }

      // Filter tickets by matching user IDs
      filter.userId = { $in: users.map((u) => u._id) };
    }

    if (schedulingId) filter.schedulingId = new Types.ObjectId(schedulingId);
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email phone')
        .populate('seatId', 'seatNo status')
        .populate('schedulingId')
        .populate('promotionId', 'name value')
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async calculatePricePreview(schedulingId: string) {
    const scheduling = await this.schedulingModel.findById(schedulingId).exec();
    if (!scheduling) throw new NotFoundException('Scheduling not found');
    if (!scheduling.price) {
      throw new BadRequestException(
        'Scheduling does not have price information',
      );
    }

    const promotion = await this.promotionService.findApplicablePromotion(
      scheduling.departureDate,
    );

    const discount = this.promotionService.calculateDiscount(
      scheduling.price,
      promotion.value,
    );
    const totalPrice = scheduling.price - discount;

    const expiredTime = new Date(scheduling.departureDate);
    expiredTime.setHours(expiredTime.getHours() - 3);

    return {
      originalPrice: scheduling.price,
      promotionName: promotion.name,
      promotionValue: promotion.value,
      discount,
      totalPrice,
      expiredTime,
      departureDate: scheduling.departureDate,
    };
  }

  async getUserTicketsByEmail(email: string, status?: TicketStatus) {
    // Find user by email
    const user = await this.userModel.findOne({ email }).select('_id').exec();
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const filter: any = { userId: user._id };
    if (status) filter.status = status;

    return this.ticketModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email phone')
      .populate('seatId', 'seatNo')
      .populate('schedulingId')
      .populate('promotionId', 'name value')
      .exec();
  }

  async getUserTicketsByPhone(phone: string, status?: TicketStatus) {
    // Find user by phone
    const user = await this.userModel.findOne({ phone }).select('_id').exec();
    if (!user) {
      throw new NotFoundException(`User with phone ${phone} not found`);
    }

    const filter: any = { userId: user._id };
    if (status) filter.status = status;

    return this.ticketModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email phone')
      .populate('seatId', 'seatNo')
      .populate('schedulingId')
      .populate('promotionId', 'name value')
      .exec();
  }

  async getTicketsByScheduling(schedulingId: string, status?: TicketStatus) {
    const filter: any = { schedulingId: new Types.ObjectId(schedulingId) };
    if (status) filter.status = status;

    return this.ticketModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName phone')
      .populate('seatId', 'seatNo')
      .exec();
  }

  private validateStatusTransition(
    currentStatus: TicketStatus,
    newStatus: TicketStatus,
  ) {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.PENDING]: [TicketStatus.SUCCESS, TicketStatus.FAILED],
      [TicketStatus.SUCCESS]: [TicketStatus.TRANSFER, TicketStatus.FAILED],
      [TicketStatus.FAILED]: [],
      [TicketStatus.TRANSFER]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  // ============================================
  // VNPAY INTEGRATION
  // ============================================
  async createPaymentUrl(
    ticketId: string,
    ipAddr: string,
  ): Promise<{
    success: boolean;
    paymentUrl: string;
    transactionId: string;
    amount: number;
    expiredTime: Date;
  }> {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('schedulingId')
      .populate('seatId', 'seatNo')
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status !== TicketStatus.PENDING) {
      throw new BadRequestException('Only PENDING tickets can be paid');
    }

    const now = new Date();
    if (now > ticket.expiredTime) {
      throw new BadRequestException('Ticket has expired');
    }

    const transactionId = `TICKET_${ticketId}_${Date.now()}`;

    const scheduling = ticket.schedulingId as any;
    const seat = ticket.seatId as any;
    const route = await this.routeModel.findById(scheduling.routeId).lean();

    const orderInfo = `Thanh toan ve xe ${route?.name || 'Bus'} Ghe ${seat?.seatNo}`;

    const paymentUrl = this.vnpayService.createPaymentUrl({
      amount: ticket.totalPrice,
      orderInfo,
      orderId: transactionId,
      ipAddr,
    });

    ticket.transactionId = transactionId;
    await ticket.save();

    return {
      success: true,
      paymentUrl,
      transactionId,
      amount: ticket.totalPrice,
      expiredTime: ticket.expiredTime,
    };
  }

  async handleVNPayCallback(vnpParams: any): Promise<{
    success: boolean;
    message: string;
    ticket?: any;
    paymentInfo?: any;
  }> {
    const verifyResult = this.vnpayService.verifyReturnUrl(vnpParams);

    if (!verifyResult.isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    const transactionId = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode;
    const vnpayTransactionNo = vnpParams.vnp_TransactionNo;
    const bankCode = vnpParams.vnp_BankCode;
    const amount = parseInt(vnpParams.vnp_Amount) / 100;

    const ticket = await this.ticketModel.findOne({ transactionId }).exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found with this transaction ID');
    }

    ticket.vnpayTransactionNo = vnpayTransactionNo;
    ticket.responseCode = responseCode;
    ticket.responseMessage = verifyResult.message;
    ticket.bankCode = bankCode;

    if (responseCode === '00') {
      ticket.paidAt = new Date();

      if (!ticket.snapshot) {
        ticket.snapshot = await this.buildSnapshot(
          ticket.seatId,
          ticket.schedulingId,
          ticket.promotionId,
          ticket.totalPrice,
        );
      }

      ticket.status = TicketStatus.SUCCESS;
      await ticket.save();

      await this.seatService.confirmSeat(ticket.seatId.toString());

      const fullTicket = await this.findOne(String(ticket._id));

      return {
        success: true,
        message: 'Thanh toán thành công',
        ticket: fullTicket,
        paymentInfo: {
          transactionId,
          vnpayTransactionNo,
          amount,
          bankCode,
          paidAt: ticket.paidAt,
          responseCode,
        },
      };
    } else {
      if (!ticket.snapshot) {
        ticket.snapshot = await this.buildSnapshot(
          ticket.seatId,
          ticket.schedulingId,
          ticket.promotionId,
          ticket.totalPrice,
        );
      }

      ticket.status = TicketStatus.FAILED;
      await ticket.save();

      await this.seatService.releaseSeat(ticket.seatId.toString());

      return {
        success: false,
        message: verifyResult.message,
        paymentInfo: {
          transactionId,
          vnpayTransactionNo,
          amount,
          bankCode,
          responseCode,
          responseMessage: verifyResult.message,
        },
      };
    }
  }

  async getPaymentStatus(ticketId: string) {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .select(
        'status transactionId vnpayTransactionNo responseCode responseMessage bankCode paidAt totalPrice',
      )
      .exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ticketId: String(ticket._id),
      status: ticket.status,
      paymentStatus:
        ticket.status === TicketStatus.SUCCESS
          ? 'PAID'
          : ticket.status === TicketStatus.FAILED
            ? 'FAILED'
            : 'PENDING',
      transactionId: ticket.transactionId,
      vnpayTransactionNo: ticket.vnpayTransactionNo,
      responseCode: ticket.responseCode,
      responseMessage: ticket.responseMessage,
      bankCode: ticket.bankCode,
      paidAt: ticket.paidAt,
      amount: ticket.totalPrice,
    };
  }

  // ============================================
  // ANALYTICS METHODS - Add to TicketService class
  // ============================================

  /**
   * Get revenue analytics for today
   */
  async getRevenueToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tickets = await this.ticketModel
      .find({
        status: TicketStatus.SUCCESS,
        updatedAt: {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .select('totalPrice paidAt paymentMethod updatedAt')
      .lean()
      .exec();

    const totalRevenue = tickets.reduce(
      (sum, ticket) => sum + ticket.totalPrice,
      0,
    );
    const ticketCount = tickets.length;

    // Group by payment method
    const byPaymentMethod = tickets.reduce(
      (acc, ticket) => {
        const method = ticket.paymentMethod || 'UNKNOWN';
        if (!acc[method]) {
          acc[method] = { count: 0, revenue: 0 };
        }
        acc[method].count += 1;
        acc[method].revenue += ticket.totalPrice;
        return acc;
      },
      {} as Record<string, { count: number; revenue: number }>,
    );

    return {
      date: today.toISOString().split('T')[0],
      totalRevenue,
      ticketCount,
      averageTicketPrice:
        ticketCount > 0 ? Math.round(totalRevenue / ticketCount) : 0,
      byPaymentMethod,
    };
  }

  /**
   * Get revenue analytics by scheduling
   */
  async getRevenueByScheduling(schedulingId: string) {
    const tickets = await this.ticketModel
      .find({
        schedulingId: new Types.ObjectId(schedulingId),
        status: TicketStatus.SUCCESS,
      })
      .select('totalPrice paidAt paymentMethod seatId')
      .populate('seatId', 'seatNo')
      .lean()
      .exec();

    const totalRevenue = tickets.reduce(
      (sum, ticket) => sum + ticket.totalPrice,
      0,
    );
    const ticketCount = tickets.length;

    // Group by payment method
    const byPaymentMethod = tickets.reduce(
      (acc, ticket) => {
        const method = ticket.paymentMethod || 'UNKNOWN';
        if (!acc[method]) {
          acc[method] = { count: 0, revenue: 0 };
        }
        acc[method].count += 1;
        acc[method].revenue += ticket.totalPrice;
        return acc;
      },
      {} as Record<string, { count: number; revenue: number }>,
    );

    // Get scheduling details
    const scheduling = await this.schedulingModel
      .findById(schedulingId)
      .populate('routeId', 'name')
      .populate('busId', 'licensePlate capacity')
      .lean()
      .exec();

    if (!scheduling) {
      throw new NotFoundException('Scheduling not found');
    }

    const route = scheduling.routeId as any;
    const bus = scheduling.busId as any;

    // Calculate occupancy rate
    const busCapacity = bus?.capacity || 0;
    const occupancyRate =
      busCapacity > 0 ? Math.round((ticketCount / busCapacity) * 100) : 0;

    // Ticket details list
    const ticketDetails = tickets.map((ticket: any) => ({
      seatNo: ticket.seatId?.seatNo,
      price: ticket.totalPrice,
      paymentMethod: ticket.paymentMethod,
      paidAt: ticket.paidAt,
    }));

    return {
      schedulingId,
      route: {
        name: route?.name,
        routeId: scheduling.routeId,
      },
      bus: {
        licensePlate: bus?.licensePlate,
        capacity: busCapacity,
        busId: scheduling.busId,
      },
      scheduling: {
        departureDate: scheduling.departureDate,
        arrivalDate: scheduling.arrivalDate,
        etd: scheduling.etd,
        eta: scheduling.eta,
        status: scheduling.status,
      },
      totalRevenue,
      ticketCount,
      occupancyRate,
      availableSeats: busCapacity - ticketCount,
      averageTicketPrice:
        ticketCount > 0 ? Math.round(totalRevenue / ticketCount) : 0,
      byPaymentMethod,
      ticketDetails,
    };
  }

  /**
   * Get dashboard summary with key metrics
   */
  async getDashboardSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisYear = new Date(today.getFullYear(), 0, 1);

    const [todayStats, monthStats, yearStats, totalStats] = await Promise.all([
      // Today
      this.ticketModel.aggregate([
        {
          $match: {
            status: TicketStatus.SUCCESS,
            updatedAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),
      // This month
      this.ticketModel.aggregate([
        {
          $match: {
            status: TicketStatus.SUCCESS,
            updatedAt: { $gte: thisMonth },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),
      // This year
      this.ticketModel.aggregate([
        {
          $match: {
            status: TicketStatus.SUCCESS,
            updatedAt: { $gte: thisYear },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),
      // All time
      this.ticketModel.aggregate([
        {
          $match: {
            status: TicketStatus.SUCCESS,
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalPrice' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Pending tickets
    const pendingCount = await this.ticketModel.countDocuments({
      status: TicketStatus.PENDING,
    });

    return {
      today: {
        revenue: todayStats[0]?.revenue || 0,
        ticketCount: todayStats[0]?.count || 0,
      },
      thisMonth: {
        revenue: monthStats[0]?.revenue || 0,
        ticketCount: monthStats[0]?.count || 0,
      },
      thisYear: {
        revenue: yearStats[0]?.revenue || 0,
        ticketCount: yearStats[0]?.count || 0,
      },
      allTime: {
        revenue: totalStats[0]?.revenue || 0,
        ticketCount: totalStats[0]?.count || 0,
      },
      pending: {
        ticketCount: pendingCount,
      },
    };
  }

  /**
   * Get detailed ticket list with analytics filters
   */
  async getTicketsWithAnalytics(filters: {
    period?: 'today' | 'thisMonth' | 'thisYear' | 'allTime' | 'custom';
    startDate?: Date;
    endDate?: Date;
    status?: TicketStatus;
    paymentMethod?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      period = 'allTime',
      startDate,
      endDate,
      status,
      paymentMethod,
      page = 1,
      limit = 10,
    } = filters;

    // Determine date range based on period
    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFilter = { updatedAt: { $gte: today, $lt: tomorrow } };
    } else if (period === 'thisMonth') {
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { updatedAt: { $gte: thisMonth } };
    } else if (period === 'thisYear') {
      const thisYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { updatedAt: { $gte: thisYear } };
    } else if (period === 'custom' && startDate && endDate) {
      dateFilter = { updatedAt: { $gte: startDate, $lte: endDate } };
    }

    // Build filter object
    const filter: any = {
      status: status || TicketStatus.SUCCESS,
      ...dateFilter,
    };

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    const skip = (page - 1) * limit;

    // Get tickets with populated data
    const [tickets, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email phone')
        .populate('seatId', 'seatNo')
        .populate('schedulingId', 'departureDate etd')
        .populate('promotionId', 'name value')
        .lean()
        .exec(),
      this.ticketModel.countDocuments(filter).exec(),
    ]);

    // Calculate summary for current filter
    const summary = await this.ticketModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Group by payment method
    const byPaymentMethod = await this.ticketModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalPrice' },
        },
      },
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      summary: {
        totalRevenue: summary[0]?.totalRevenue || 0,
        ticketCount: summary[0]?.count || 0,
        averageTicketPrice:
          summary[0]?.count > 0
            ? Math.round(summary[0].totalRevenue / summary[0].count)
            : 0,
      },
      byPaymentMethod: byPaymentMethod.reduce(
        (acc, item) => {
          acc[item._id || 'UNKNOWN'] = {
            count: item.count,
            revenue: item.revenue,
          };
          return acc;
        },
        {} as Record<string, { count: number; revenue: number }>,
      ),
      tickets: tickets.map((ticket: any) => ({
        _id: ticket._id,
        totalPrice: ticket.totalPrice,
        paymentMethod: ticket.paymentMethod,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        paidAt: ticket.paidAt,
        user: ticket.userId
          ? {
              name: `${ticket.userId.firstName} ${ticket.userId.lastName}`,
              email: ticket.userId.email,
              phone: ticket.userId.phone,
            }
          : null,
        seat: ticket.seatId?.seatNo,
        scheduling: ticket.schedulingId
          ? {
              departureDate: ticket.schedulingId.departureDate,
              etd: ticket.schedulingId.etd,
            }
          : null,
        promotion: ticket.promotionId
          ? {
              name: ticket.promotionId.name,
              value: ticket.promotionId.value,
            }
          : null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // ============================================
  // QR CODE GENERATION
  // ============================================

  /**
   * Generate QR code for ticket
   * Contains ticket verification information
   */
  async generateQRCode(ticketId: string): Promise<Buffer> {
    const ticketDoc = await this.ticketModel
      .findById(ticketId)
      .populate('userId', 'firstName lastName phone email')
      .populate('seatId', 'seatNo')
      .populate('schedulingId', 'departureDate arrivalDate etd eta')
      .exec();

    if (!ticketDoc) {
      throw new NotFoundException('Ticket not found');
    }

    // Cast to populated type for type safety
    const ticket = ticketDoc as unknown as TicketPopulated;

    // Create QR code data with ticket information
    const qrData = {
      ticketId: String(ticket._id),
      transactionId: ticket.transactionId,
      passengerName: `${ticket.userId.firstName} ${ticket.userId.lastName}`,
      phone: ticket.userId.phone,
      seatNo: ticket.seatId.seatNo,
      departureDate: ticket.schedulingId.departureDate,
      etd: ticket.schedulingId.etd,
      totalPrice: ticket.totalPrice,
      status: ticket.status,
      createdAt: ticket.createdAt,
    };

    // Generate QR code as buffer
    try {
      const qrBuffer = await QRCode.toBuffer(JSON.stringify(qrData), {
        type: 'png',
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      return qrBuffer;
    } catch (error) {
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  // ============================================
  // GENERATE PDF TICKET
  // ============================================
  async generateTicketPDF(ticketId: string): Promise<Buffer> {
    // Get ticket with full populated data
    const ticketDoc = await this.ticketModel
      .findById(ticketId)
      .populate('userId', 'firstName lastName phone email')
      .populate('seatId', 'seatNo')
      .populate({
        path: 'schedulingId',
        populate: [
          {
            path: 'routeId',
            select: 'name stationIds',
            populate: {
              path: 'stationIds',
              select: 'name address',
            },
          },
          { path: 'busId', select: 'licensePlate' },
        ],
      })
      .populate('promotionId', 'name value type')
      .exec();

    if (!ticketDoc) {
      throw new NotFoundException('Ticket not found');
    }

    const ticket = ticketDoc as unknown as TicketPopulated & {
      schedulingId: SchedulingDocument & {
        routeId: RouteDocument & {
          stationIds: any[];
        };
        busId: any;
      };
    };

    // Generate QR code for the ticket
    const qrBuffer = await this.generateQRCode(ticketId);

    // Get route info from stationIds array
    const route = ticket.schedulingId.routeId;
    const stations = route.stationIds || [];
    const departureStation = stations[0] || { name: 'N/A', address: 'N/A' };
    const arrivalStation =
      stations[stations.length - 1] || { name: 'N/A', address: 'N/A' };
    const departureDate = new Date(ticket.schedulingId.departureDate);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .text('VE XE KHACH', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(14)
          .font('Helvetica')
          .text('CHECK!T OUT', { align: 'center' })
          .moveDown(1);

        // Ticket ID & Status
        doc
          .fontSize(10)
          .text(`Ma ve: ${String(ticket._id)}`, { align: 'center' })
          .text(
            `Trang thai: ${ticket.status === 'SUCCESS' ? 'Da thanh toan' : ticket.status}`,
            { align: 'center' },
          )
          .moveDown(1);

        // Horizontal line
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .stroke()
          .moveDown(1);

        // Route Information
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('THONG TIN CHUYEN DI', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .font('Helvetica')
          .text(`Tuyen: ${departureStation.name} -> ${arrivalStation.name}`)
          .moveDown(0.3);

        doc
          .fontSize(10)
          .text(`Diem di: ${departureStation.name}`)
          .text(`Dia chi: ${departureStation.address || 'N/A'}`)
          .moveDown(0.3);

        doc
          .text(`Diem den: ${arrivalStation.name}`)
          .text(`Dia chi: ${arrivalStation.address || 'N/A'}`)
          .moveDown(0.5);

        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(
            `Ngay khoi hanh: ${departureDate.toLocaleDateString('vi-VN')}`,
          )
          .moveDown(0.3);

        doc
          .fontSize(11)
          .font('Helvetica')
          .text(`Gio xuat ben: ${ticket.schedulingId.etd}`)
          .text(`Gio den du kien: ${ticket.schedulingId.eta}`)
          .text(`Bien so xe: ${ticket.schedulingId.busId.licensePlate}`)
          .moveDown(1);

        // Passenger Information
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('THONG TIN HANH KHACH', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .font('Helvetica')
          .text(
            `Ho ten: ${ticket.userId.firstName} ${ticket.userId.lastName}`,
          )
          .text(`So dien thoai: ${ticket.userId.phone}`)
          .text(`So ghe: ${ticket.seatId.seatNo}`)
          .moveDown(1);

        // Payment Information
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('THONG TIN THANH TOAN', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(12)
          .font('Helvetica')
          .text(`Gia ve: ${ticket.totalPrice.toLocaleString('vi-VN')} VND`)
          .text(
            `Phuong thuc: ${ticket.paymentMethod === 'BANKING' ? 'Chuyen khoan' : 'Tien mat'}`,
          );

        if (ticket.promotionId) {
          doc.text(`Khuyen mai: ${ticket.promotionId.name}`);
        }

        doc.moveDown(1);

        // QR Code
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('MA QR VE', { align: 'center' })
          .moveDown(0.5);

        // Add QR code image
        const qrX = (doc.page.width - 200) / 2;
        doc.image(qrBuffer, qrX, doc.y, { width: 200 });
        doc.moveDown(10);

        // Footer
        doc
          .fontSize(9)
          .font('Helvetica')
          .text('Vui long xuat trinh ve nay khi len xe', { align: 'center' })
          .moveDown(0.3)
          .text(
            `Ngay in: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`,
            { align: 'center' },
          )
          .moveDown(0.5)
          .fontSize(8)
          .text('Cam on quy khach da su dung dich vu CHECK!T OUT', {
            align: 'center',
          });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
