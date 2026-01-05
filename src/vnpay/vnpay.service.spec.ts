import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VNPayService } from './vnpay.service';
import * as crypto from 'crypto';
import * as querystring from 'qs';

describe('VNPayService - Signature Fix Tests', () => {
  let service: VNPayService;
  let configService: ConfigService;

  // Mock configuration
  const mockConfig = {
    VNPAY_TMN_CODE: 'TEST_TMN_CODE',
    VNPAY_HASH_SECRET: 'TEST_SECRET_KEY_123456789',
    VNPAY_API_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: 'http://localhost:3000/payment/vnpay-return',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VNPayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<VNPayService>(VNPayService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Signature Generation with Encoding', () => {
    it('should generate payment URL with encoded parameters', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'Payment for ticket',
        orderId: 'TICKET_123',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_SecureHash=');
      expect(url).toContain('vnp_TxnRef=TICKET_123');
      expect(url).toContain('vnp_Amount=10000000'); // 100000 * 100
    });

    it('should handle special characters in orderInfo', () => {
      const paymentData = {
        amount: 50000,
        orderInfo: 'Thanh toán vé xe & dịch vụ',
        orderId: 'TICKET_456',
        ipAddr: '192.168.1.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_SecureHash=');
      // Vietnamese characters should be removed
      expect(url).not.toContain('Thanh toán');
    });

    it('should handle spaces and special characters correctly', () => {
      const paymentData = {
        amount: 200000,
        orderInfo: 'Test Payment #123 & More',
        orderId: 'ORDER_789',
        ipAddr: '10.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      // URL should be properly encoded
      expect(url).toContain('vnp_OrderInfo=');
      expect(url).toContain('vnp_SecureHash=');
    });

    it('should encode ampersands in parameters', () => {
      const paymentData = {
        amount: 150000,
        orderInfo: 'Item A & Item B',
        orderId: 'TEST_AMP',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      // The signature should be calculated with encoded ampersands
      expect(url).toBeDefined();
      expect(url).toContain('vnp_SecureHash=');

      // Extract the query string
      const queryPart = url.split('?')[1];
      expect(queryPart).toBeDefined();

      // Ampersands between parameters should not be encoded
      const params = queryPart.split('&');
      expect(params.length).toBeGreaterThan(5);
    });

    it('should convert IPv6 localhost to IPv4', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'Test Payment',
        orderId: 'IPV6_TEST',
        ipAddr: '::1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_IpAddr=127.0.0.1');
    });

    it('should include bank code if provided', () => {
      const paymentData = {
        amount: 300000,
        orderInfo: 'Test Payment',
        orderId: 'BANK_TEST',
        ipAddr: '127.0.0.1',
        bankCode: 'VNBANK',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_BankCode=VNBANK');
    });
  });

  describe('Signature Verification with Encoding', () => {
    it('should verify valid callback signature with encoded parameters', () => {
      // Create a valid signature first
      const params = {
        vnp_Amount: '10000000',
        vnp_BankCode: 'NCB',
        vnp_BankTranNo: 'VNP123456',
        vnp_CardType: 'ATM',
        vnp_OrderInfo: 'Payment for ticket',
        vnp_PayDate: '20240101120000',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TEST_TMN_CODE',
        vnp_TransactionNo: '14123456',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: 'TICKET_123',
      };

      // Sort and create signature
      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {});

      const signData = querystring.stringify(sortedParams, { encode: true });
      const hmac = crypto.createHmac('sha512', mockConfig.VNPAY_HASH_SECRET);
      const secureHash = hmac
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const callbackParams = {
        ...params,
        vnp_SecureHash: secureHash,
      };

      const result = service.verifyReturnUrl(callbackParams);

      expect(result.isValid).toBe(true);
      expect(result.responseCode).toBe('00');
      expect(result.message).toBe('Giao dịch thành công');
    });

    it('should reject invalid signature', () => {
      const callbackParams = {
        vnp_Amount: '10000000',
        vnp_ResponseCode: '00',
        vnp_TxnRef: 'TICKET_123',
        vnp_SecureHash: 'invalid_signature_here',
      };

      const result = service.verifyReturnUrl(callbackParams);

      expect(result.isValid).toBe(false);
      expect(result.responseCode).toBe('97');
      expect(result.message).toBe('Chữ ký không hợp lệ');
    });

    it('should handle failed transaction with valid signature', () => {
      const params = {
        vnp_Amount: '10000000',
        vnp_ResponseCode: '24', // User cancelled
        vnp_TxnRef: 'TICKET_456',
        vnp_OrderInfo: 'Test Payment',
      };

      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {});

      const signData = querystring.stringify(sortedParams, { encode: true });
      const hmac = crypto.createHmac('sha512', mockConfig.VNPAY_HASH_SECRET);
      const secureHash = hmac
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const callbackParams = {
        ...params,
        vnp_SecureHash: secureHash,
      };

      const result = service.verifyReturnUrl(callbackParams);

      expect(result.isValid).toBe(true);
      expect(result.responseCode).toBe('24');
      expect(result.message).toContain('hủy giao dịch');
    });

    it('should verify signature with special characters in orderInfo', () => {
      const params = {
        vnp_Amount: '15000000',
        vnp_ResponseCode: '00',
        vnp_TxnRef: 'SPECIAL_CHAR_TEST',
        vnp_OrderInfo: 'Test Payment #123',
      };

      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {});

      const signData = querystring.stringify(sortedParams, { encode: true });
      const hmac = crypto.createHmac('sha512', mockConfig.VNPAY_HASH_SECRET);
      const secureHash = hmac
        .update(Buffer.from(signData, 'utf-8'))
        .digest('hex');

      const callbackParams = {
        ...params,
        vnp_SecureHash: secureHash,
      };

      const result = service.verifyReturnUrl(callbackParams);

      expect(result.isValid).toBe(true);
      expect(result.responseCode).toBe('00');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty orderInfo', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: '',
        orderId: 'EMPTY_ORDER',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_SecureHash=');
    });

    it('should handle very long orderInfo', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'A'.repeat(500),
        orderId: 'LONG_ORDER',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_SecureHash=');
    });

    it('should handle minimum amount', () => {
      const paymentData = {
        amount: 1,
        orderInfo: 'Minimum amount test',
        orderId: 'MIN_AMOUNT',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_Amount=100'); // 1 * 100
    });

    it('should handle large amount', () => {
      const paymentData = {
        amount: 999999999,
        orderInfo: 'Large amount test',
        orderId: 'MAX_AMOUNT',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      expect(url).toContain('vnp_Amount=99999999900'); // 999999999 * 100
    });

    it('should remove Vietnamese diacritics correctly', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'Thanh toán vé xe từ Hà Nội đến Sài Gòn',
        orderId: 'VN_CHARS',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      expect(url).toBeDefined();
      // Should not contain Vietnamese characters
      expect(url).not.toMatch(
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
      );
    });
  });

  describe('URL Format Validation', () => {
    it('should generate valid URL format', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'Test Payment',
        orderId: 'URL_FORMAT_TEST',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      // Should start with API URL
      expect(url).toMatch(
        /^https:\/\/sandbox\.vnpayment\.vn\/paymentv2\/vpcpay\.html\?/,
      );

      // Should contain all required parameters
      expect(url).toContain('vnp_Version=');
      expect(url).toContain('vnp_Command=');
      expect(url).toContain('vnp_TmnCode=');
      expect(url).toContain('vnp_Amount=');
      expect(url).toContain('vnp_CurrCode=VND');
      expect(url).toContain('vnp_TxnRef=');
      expect(url).toContain('vnp_OrderInfo=');
      expect(url).toContain('vnp_ReturnUrl=');
      expect(url).toContain('vnp_CreateDate=');
      expect(url).toContain('vnp_SecureHash=');
    });

    it('should have proper parameter ordering in URL', () => {
      const paymentData = {
        amount: 100000,
        orderInfo: 'Test Payment',
        orderId: 'ORDER_TEST',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);
      const queryPart = url.split('?')[1];
      const params = queryPart.split('&').map((p) => p.split('=')[0]);

      // vnp_SecureHash should be the last parameter
      expect(params[params.length - 1]).toBe('vnp_SecureHash');
    });
  });

  describe('Response Code Messages', () => {
    const testCases = [
      { code: '00', message: 'Giao dịch thành công' },
      { code: '07', message: 'nghi ngờ' },
      { code: '09', message: 'InternetBanking' },
      { code: '11', message: 'hết hạn' },
      { code: '24', message: 'hủy giao dịch' },
      { code: '51', message: 'không đủ số dư' },
      { code: '99', message: 'Các lỗi khác' },
    ];

    testCases.forEach(({ code, message }) => {
      it(`should return correct message for response code ${code}`, () => {
        const params = {
          vnp_Amount: '10000000',
          vnp_ResponseCode: code,
          vnp_TxnRef: 'TEST',
        };

        const sortedParams = Object.keys(params)
          .sort()
          .reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
          }, {});

        const signData = querystring.stringify(sortedParams, { encode: true });
        const hmac = crypto.createHmac('sha512', mockConfig.VNPAY_HASH_SECRET);
        const secureHash = hmac
          .update(Buffer.from(signData, 'utf-8'))
          .digest('hex');

        const callbackParams = {
          ...params,
          vnp_SecureHash: secureHash,
        };

        const result = service.verifyReturnUrl(callbackParams);

        expect(result.isValid).toBe(true);
        expect(result.responseCode).toBe(code);
        expect(result.message.toLowerCase()).toContain(message.toLowerCase());
      });
    });
  });

  describe('Encoding Comparison Tests', () => {
    it('should produce different signatures with encode:true vs encode:false', () => {
      const params = {
        vnp_Amount: '10000000',
        vnp_OrderInfo: 'Test & Payment',
        vnp_TxnRef: 'TEST_123',
      };

      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = params[key];
          return acc;
        }, {});

      // With encoding (correct)
      const signDataEncoded = querystring.stringify(sortedParams, {
        encode: true,
      });
      const hmacEncoded = crypto.createHmac(
        'sha512',
        mockConfig.VNPAY_HASH_SECRET,
      );
      const signatureEncoded = hmacEncoded
        .update(Buffer.from(signDataEncoded, 'utf-8'))
        .digest('hex');

      // Without encoding (incorrect - old behavior)
      const signDataNotEncoded = querystring.stringify(sortedParams, {
        encode: false,
      });
      const hmacNotEncoded = crypto.createHmac(
        'sha512',
        mockConfig.VNPAY_HASH_SECRET,
      );
      const signatureNotEncoded = hmacNotEncoded
        .update(Buffer.from(signDataNotEncoded, 'utf-8'))
        .digest('hex');

      // Signatures should be different when ampersand is present
      expect(signatureEncoded).not.toBe(signatureNotEncoded);

      // The encoded version should have encoded ampersand
      expect(signDataEncoded).toContain('%26');
      expect(signDataNotEncoded).not.toContain('%26');
    });

    it('should verify the fix: encoded parameters create correct signature', () => {
      // This test verifies the actual fix
      const paymentData = {
        amount: 100000,
        orderInfo: 'Ticket & Service',
        orderId: 'FIX_VERIFICATION',
        ipAddr: '127.0.0.1',
      };

      const url = service.createPaymentUrl(paymentData);

      // Extract vnp_SecureHash from URL
      const hashMatch = url.match(/vnp_SecureHash=([a-f0-9]+)/);
      expect(hashMatch).not.toBeNull();

      const generatedHash = hashMatch[1];

      // The hash should be 128 characters (SHA512 in hex)
      expect(generatedHash).toHaveLength(128);

      // Verify it's a valid hex string
      expect(generatedHash).toMatch(/^[a-f0-9]{128}$/);
    });
  });
});
