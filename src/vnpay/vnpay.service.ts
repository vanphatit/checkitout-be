import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as querystring from 'qs';

export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  apiUrl: string;
  returnUrl: string;
  version: string;
  command: string;
  orderType: string;
}

export interface CreatePaymentUrlDto {
  amount: number;
  orderInfo: string;
  orderId: string;
  ipAddr: string;
  locale?: string;
  bankCode?: string;
}

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);
  private config: VNPayConfig;

  constructor(private configService: ConfigService) {
  const tmnCode = this.configService.get<string>('VNPAY_TMN_CODE');
  const hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');
  const apiUrl = this.configService.get<string>('VNPAY_API_URL');
  const returnUrl = this.configService.get<string>('VNPAY_RETURN_URL');

  // LOG ĐỂ DEBUG
  this.logger.log('=====================================');
  this.logger.log('🔧 LOADING VNPAY CONFIG FROM .ENV');
  this.logger.log('=====================================');
  this.logger.log(`TMN Code: ${tmnCode}`);
  this.logger.log(`Hash Secret (first 10): ${hashSecret?.substring(0, 10)}...`);
  this.logger.log(`Hash Secret (length): ${hashSecret?.length}`);
  this.logger.log(`API URL: ${apiUrl}`);
  this.logger.log(`Return URL: ${returnUrl}`);
  this.logger.log('=====================================');

  if (!tmnCode || !hashSecret || !apiUrl || !returnUrl) {
    const missing: string[] = [];
    if (!tmnCode) missing.push('VNPAY_TMN_CODE');
    if (!hashSecret) missing.push('VNPAY_HASH_SECRET');
    if (!apiUrl) missing.push('VNPAY_API_URL');
    if (!returnUrl) missing.push('VNPAY_RETURN_URL');
    
    throw new Error(
      `VNPay configuration is missing: ${missing.join(', ')}. ` +
      'Please add them to your .env file.'
    );
  }

  this.config = {
    tmnCode,
    hashSecret,
    apiUrl,
    returnUrl,
    version: '2.1.0',
    command: 'pay',
    orderType: 'other',
  };

  this.logger.log('🔧 VNPay Config Initialized Successfully\n');
}

  /**
   * Remove Vietnamese diacritics
   */
  private removeVietnameseDiacritics(str: string): string {
    const diacriticsMap: Record<string, string> = {
      'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 
      'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a', 
      'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
      'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 
      'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
      'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
      'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 
      'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o', 
      'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
      'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 
      'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
      'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
      'đ': 'd',
      'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A', 
      'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 
      'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
      'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 
      'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
      'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O', 
      'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O', 
      'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
      'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U', 
      'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
      'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
      'Đ': 'D'
    };

    return str
      .split('')
      .map(char => diacriticsMap[char] || char)
      .join('')
      .replace(/[^a-zA-Z0-9\s\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Format date theo VNPay: yyyyMMddHHmmss với GMT+7
   * Giống với Java: SimpleDateFormat("yyyyMMddHHmmss") với TimeZone GMT+7
   */
  private formatDate(date: Date): string {
    // Convert to GMT+7 (Vietnam timezone)
    const vnDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const year = vnDate.getFullYear();
    const month = String(vnDate.getMonth() + 1).padStart(2, '0');
    const day = String(vnDate.getDate()).padStart(2, '0');
    const hour = String(vnDate.getHours()).padStart(2, '0');
    const minute = String(vnDate.getMinutes()).padStart(2, '0');
    const second = String(vnDate.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Sort object theo alphabet
   */
  private sortObject(obj: any): any {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  /**
   * Tạo URL thanh toán - Follow Java Config Pattern
   */
  createPaymentUrl(data: CreatePaymentUrlDto): string {
    this.logger.log('=====================================');
    this.logger.log('🚀 START CREATE PAYMENT URL');
    this.logger.log('=====================================');

    // Clean orderInfo - remove Vietnamese diacritics
    const cleanOrderInfo = this.removeVietnameseDiacritics(data.orderInfo);
    this.logger.log(`📝 Original OrderInfo: "${data.orderInfo}"`);
    this.logger.log(`✨ Cleaned OrderInfo: "${cleanOrderInfo}"`);

    // Fix IP Address (convert ::1 to 127.0.0.1)
    let ipAddr = data.ipAddr;
    if (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1') {
      ipAddr = '127.0.0.1';
    }
    this.logger.log(`🌐 IP Address: ${data.ipAddr} → ${ipAddr}`);

    // Get current time in GMT+7 (like Java Calendar with GMT+7)
    const now = new Date();
    const createDate = this.formatDate(now);
    
    // Expire date = now + 15 minutes
    const expireDate = this.formatDate(new Date(now.getTime() + 15 * 60 * 1000));

    this.logger.log(`⏰ CreateDate: ${createDate}`);
    this.logger.log(`⏰ ExpireDate: ${expireDate}`);

    // Build params - EXACTLY like Java getVNPayConfig()
    let vnpParams: any = {
      vnp_Version: this.config.version,
      vnp_Command: this.config.command,
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: data.amount * 100, // VNPay requires amount * 100
      vnp_CurrCode: 'VND',
      vnp_TxnRef: data.orderId,
      vnp_OrderInfo: cleanOrderInfo,
      vnp_OrderType: this.config.orderType,
      vnp_Locale: data.locale || 'vn',
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    if (data.bankCode) {
      vnpParams.vnp_BankCode = data.bankCode;
    }

    this.logger.log('📦 Original Params:');
    this.logger.log(JSON.stringify(vnpParams, null, 2));

    // Sort params alphabetically
    vnpParams = this.sortObject(vnpParams);

    this.logger.log('🔢 Sorted Params:');
    this.logger.log(JSON.stringify(vnpParams, null, 2));

    // Create sign data (NO ENCODING for hash calculation)
    const signData = querystring.stringify(vnpParams, { encode: false });
    
    this.logger.log('=====================================');
    this.logger.log('🔐 SIGN DATA (for hashing - NO ENCODING):');
    this.logger.log(signData);
    this.logger.log('=====================================');

    // Calculate HMAC SHA512 hash
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    this.logger.log('🔑 Hash Secret (first 10 chars): ' + this.config.hashSecret.substring(0, 10) + '...');
    this.logger.log('✅ Generated SecureHash: ' + signed);
    this.logger.log('=====================================');

    vnpParams.vnp_SecureHash = signed;

    // Create final URL (WITH ENCODING for HTTP transmission)
    const paymentUrl = this.config.apiUrl + '?' + querystring.stringify(vnpParams, { encode: true });
    
    this.logger.log('🌐 FINAL PAYMENT URL (WITH ENCODING):');
    this.logger.log(paymentUrl);
    this.logger.log('=====================================');
    this.logger.log('✅ CREATE PAYMENT URL COMPLETED');
    this.logger.log('=====================================\n');
    
    return paymentUrl;
  }

  /**
   * Verify callback từ VNPay
   */
  verifyReturnUrl(vnpParams: any): { 
    isValid: boolean; 
    message: string;
    responseCode: string;
  } {
    this.logger.log('=====================================');
    this.logger.log('🔍 START VERIFY VNPAY CALLBACK');
    this.logger.log('=====================================');

    const secureHash = vnpParams.vnp_SecureHash;
    const responseCode = vnpParams.vnp_ResponseCode;
    
    this.logger.log('📨 Received SecureHash: ' + secureHash);
    this.logger.log('📨 Response Code: ' + responseCode);

    // Create a copy
    const params = { ...vnpParams };
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    // Sort params
    const sortedParams = this.sortObject(params);
    const signData = querystring.stringify(sortedParams, { encode: false });
    
    this.logger.log('🔐 SIGN DATA (for verification):');
    this.logger.log(signData);
    
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    this.logger.log('✅ Calculated Hash: ' + signed);
    this.logger.log('🔍 Hashes Match: ' + (secureHash === signed));
    this.logger.log('=====================================');

    if (secureHash === signed) {
      this.logger.log('✅ SIGNATURE VALID');
      
      if (responseCode === '00') {
        this.logger.log('✅ PAYMENT SUCCESS');
        return { 
          isValid: true, 
          message: 'Giao dịch thành công',
          responseCode 
        };
      } else {
        this.logger.log(`⚠️ PAYMENT FAILED - Code: ${responseCode}`);
        return { 
          isValid: true, 
          message: this.getResponseMessage(responseCode),
          responseCode
        };
      }
    } else {
      this.logger.error('❌ SIGNATURE INVALID');
      return { 
        isValid: false, 
        message: 'Chữ ký không hợp lệ',
        responseCode: '97'
      };
    }
  }

  /**
   * Get response message from code
   */
  private getResponseMessage(code: string): string {
    const messages: Record<string, string> = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do: Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư.',
      '65': 'Giao dịch không thành công do: Tài khoản đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Các lỗi khác',
    };
    return messages[code] || 'Lỗi không xác định';
  }
}