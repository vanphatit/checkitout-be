import { 
  Injectable, 
  BadRequestException, 
  NotFoundException 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ticket, TicketDocument, TicketSnapshot } from './entities/ticket.entity';
import { TicketStatus } from './enums/ticket-status.enum';
import { SeatService } from '../seat/seat.service';
import { Scheduling, SchedulingDocument } from '../scheduling/entities/scheduling.entity';
import { Route, RouteDocument } from '../route/entities/route.entity';
import { PromotionService } from '../promotion/promotion.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { SeatStatus } from '../seat/enums/seat-status.enum';


@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Scheduling.name) private schedulingModel: Model<SchedulingDocument>,
    @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
    private readonly seatService: SeatService,  // ✅ Inject SeatService
    private readonly promotionService: PromotionService,
  ) {}

  // ============================================
  // 🔒 BUILD SNAPSHOT - Core Logic
  // ============================================
  private async buildSnapshot(
    seatId: Types.ObjectId,
    schedulingId: Types.ObjectId,
    promotionId: Types.ObjectId,
    totalPrice: number,
  ): Promise<TicketSnapshot> {
    // 1. Get all related data using services
    const [seat, scheduling, promotion] = await Promise.all([
      this.seatService.getSeatForSnapshot(seatId.toString()),  // ✅ Use SeatService
      this.schedulingModel.findById(schedulingId).lean().exec(),
      this.promotionService.findOne(promotionId.toString()),
    ]);

    if (!seat || !scheduling || !promotion) {
      throw new NotFoundException('Related data not found for snapshot');
    }

    // 2. Validate required fields
    if (scheduling.price === undefined || scheduling.price === null) {
      throw new BadRequestException('Scheduling must have price for snapshot');
    }

    // 3. Get route info
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

    // 4. Calculate pricing breakdown
    const originalPrice = scheduling.price;
    const discountAmount = this.promotionService.calculateDiscount(
      originalPrice,
      promotion.value
    );

    // 5. Build snapshot object
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
        promotionId: (promotion._id as Types.ObjectId).toString(),
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
  // CREATE TICKET (using SeatService)
  // ============================================
  async create(dto: CreateTicketDto) {
    // 1. Get and validate scheduling
    const scheduling = await this.schedulingModel.findById(dto.schedulingId).exec();
    if (!scheduling) {
      throw new NotFoundException('Scheduling not found');
    }
    if (!scheduling.price) {
      throw new BadRequestException('Scheduling does not have price information');
    }

    // 2. Validate scheduling is in the future
    const now = new Date();
    if (scheduling.departureDate <= now) {
      throw new BadRequestException('Cannot book ticket for past scheduling');
    }

    // 3. Calculate expired time (3 hours before departure)
    const expiredTime = new Date(scheduling.departureDate);
    expiredTime.setHours(expiredTime.getHours() - 3);

    if (expiredTime <= now) {
      throw new BadRequestException(
        'Cannot book ticket: departure time is too soon (less than 3 hours from now)'
      );
    }

    // 4. ✅ Check seat availability and validate using SeatService
    await this.seatService.checkSeatAvailability(
      dto.seatId,
      scheduling.busId.toString()
    );

    // 5. Find applicable promotion
    const promotion = await this.promotionService.findApplicablePromotion(
      scheduling.departureDate
    );

    // 6. Calculate final price
    const totalPrice = this.promotionService.calculateFinalPrice(
      scheduling.price,
      promotion.value
    );

    // 7. Create ticket
    const ticket = new this.ticketModel({
      userId: new Types.ObjectId(dto.userId),
      seatId: new Types.ObjectId(dto.seatId),
      schedulingId: new Types.ObjectId(dto.schedulingId),
      promotionId: promotion._id as Types.ObjectId,
      paymentMethod: dto.paymentMethod,
      fallbackURL: dto.fallbackURL,
      totalPrice,
      expiredTime,
      status: TicketStatus.PENDING,
      snapshot: null,
    });

    const savedTicket = await ticket.save();

    // 8. ✅ Reserve seat using SeatService (EMPTY → PENDING)
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
  // UPDATE STATUS (with Snapshot & SeatService)
  // ============================================
  async updateStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) throw new NotFoundException('Ticket not found');

    this.validateStatusTransition(ticket.status, dto.status);

    // Validate expiry for SUCCESS transition
    if (dto.status === TicketStatus.SUCCESS && ticket.status === TicketStatus.PENDING) {
      const now = new Date();
      if (now > ticket.expiredTime) {
        throw new BadRequestException('Cannot confirm: ticket has expired');
      }
    }

    //  Create snapshot when status becomes final
    const shouldCreateSnapshot = 
      dto.status === TicketStatus.SUCCESS ||
      dto.status === TicketStatus.FAILED;

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
    await ticket.save();

    //  Update seat status using SeatService
    if (dto.status === TicketStatus.SUCCESS) {
      await this.seatService.confirmSeat(ticket.seatId.toString());
    } else if (dto.status === TicketStatus.FAILED) {
      await this.seatService.releaseSeat(ticket.seatId.toString());
    }

    return this.findOne(id);
  }

  // ============================================
  // TRANSFER TICKET (with Snapshot & SeatService)
  // ============================================
  async transfer(oldTicketId: string, dto: TransferTicketDto) {
    // 1. Get old ticket
    const oldTicket = await this.ticketModel.findById(oldTicketId).exec();
    if (!oldTicket) throw new NotFoundException('Old ticket not found');

    if (oldTicket.status !== TicketStatus.SUCCESS) {
      throw new BadRequestException('Can only transfer confirmed (SUCCESS) tickets');
    }

    // 2. Get old scheduling
    const oldScheduling = await this.schedulingModel
      .findById(oldTicket.schedulingId)
      .exec();
    if (!oldScheduling) throw new NotFoundException('Old scheduling not found');

    // 3. Check if transfer is allowed (at least 3 hours before departure)
    const now = new Date();
    const threeHoursBefore = new Date(oldScheduling.departureDate);
    threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);

    if (now >= threeHoursBefore) {
      throw new BadRequestException(
        'Cannot transfer ticket: must be at least 3 hours before departure'
      );
    }

    // 4. Get new scheduling
    const newScheduling = await this.schedulingModel
      .findById(dto.newSchedulingId)
      .exec();
    if (!newScheduling) throw new NotFoundException('New scheduling not found');
    if (!newScheduling.price) {
      throw new BadRequestException('New scheduling does not have price information');
    }

    // 5. Validate same route and price
    if (oldScheduling.routeId.toString() !== newScheduling.routeId.toString()) {
      throw new BadRequestException('Transfer must be on the same route');
    }
    if (oldScheduling.price !== newScheduling.price) {
      throw new BadRequestException('Transfer requires same price');
    }

    // 6. Check new seat availability using SeatService
    await this.seatService.checkSeatAvailability(
      dto.newSeatId,
      newScheduling.busId.toString()
    );

    // 7. Find applicable promotion for new scheduling
    const promotion = await this.promotionService.findApplicablePromotion(
      newScheduling.departureDate
    );

    // 8. Calculate new price and expired time
    const totalPrice = this.promotionService.calculateFinalPrice(
      newScheduling.price,
      promotion.value
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

    // 10. Create new ticket
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
    });

    const savedNewTicket = await newTicket.save();

    // 11. Create snapshot for old ticket if not exists
    if (!oldTicket.snapshot) {
      oldTicket.snapshot = await this.buildSnapshot(
        oldTicket.seatId,
        oldTicket.schedulingId,
        oldTicket.promotionId,
        oldTicket.totalPrice,
      );
    }

    oldTicket.status = TicketStatus.TRANSFER;
    oldTicket.transferTicketId = savedNewTicket._id as Types.ObjectId;
    await oldTicket.save();

    // 12. Update seat statuses using SeatService
    await Promise.all([
      this.seatService.releaseSeat(oldTicket.seatId.toString()),  // Old seat → EMPTY
      this.seatService.confirmSeat(dto.newSeatId),  // New seat → SOLD (but from EMPTY, so need special handling)
    ]);

    // Fix: new seat needs to be reserved first then confirmed
    // Actually, let's just update to SOLD directly since we already checked availability
    await this.seatService.updateSeatStatus(dto.newSeatId, SeatStatus.SOLD);

    return {
      oldTicket: await this.findOne((oldTicket._id as Types.ObjectId).toString()),
      newTicket: await this.findOne((savedNewTicket._id as Types.ObjectId).toString()),
      message: 'Ticket transferred successfully',
    };
  }

  // ============================================
  // CANCEL EXPIRED TICKETS (with Snapshot & SeatService)
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
      // Create snapshot before failing
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

    // Bulk release seats using SeatService
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
  // MANUAL FAIL TICKET (with Snapshot & SeatService)
  // ============================================
  async failTicket(id: string, reason?: string) {
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.PENDING) {
      throw new BadRequestException('Can only fail PENDING tickets');
    }

    // Create snapshot before failing
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

    // Release seat using SeatService
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
      userId,
      schedulingId,
      status,
      paymentMethod,
      fromDate,
      toDate,
    } = query;

    const filter: any = {};

    if (userId) filter.userId = new Types.ObjectId(userId);
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
      throw new BadRequestException('Scheduling does not have price information');
    }

    const promotion = await this.promotionService.findApplicablePromotion(
      scheduling.departureDate
    );

    const discount = this.promotionService.calculateDiscount(
      scheduling.price,
      promotion.value
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

  async getUserTickets(userId: string, status?: TicketStatus) {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (status) filter.status = status;

    return this.ticketModel
      .find(filter)
      .sort({ createdAt: -1 })
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

  private validateStatusTransition(currentStatus: TicketStatus, newStatus: TicketStatus) {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.PENDING]: [TicketStatus.SUCCESS, TicketStatus.FAILED],
      [TicketStatus.SUCCESS]: [TicketStatus.TRANSFER, TicketStatus.FAILED],
      [TicketStatus.FAILED]: [],
      [TicketStatus.TRANSFER]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}