// =====================================================================
// Lớp gửi email — cùng kiểu "Strategy pattern" với push (src/push/index.ts)
//   EMAIL_PROVIDER=log     -> chỉ in ra console (mặc định khi chạy local)
//   EMAIL_PROVIDER=resend  -> gửi thật qua https://resend.com (cần RESEND_API_KEY)
// Resend có REST API rất đơn giản nên gọi thẳng bằng fetch, không cần cài SDK.
// =====================================================================
import { config } from '../config';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string; // bản chữ thuần cho ứng dụng mail không hiển thị HTML
}

export interface EmailProvider {
  name: string;
  /** Trả về true nếu gửi thành công */
  send(message: EmailMessage): Promise<boolean>;
}

class LogEmailProvider implements EmailProvider {
  name = 'log';
  async send(m: EmailMessage) {
    console.log(`[email:log] → ${m.to} | ${m.subject}\n${m.text}\n`);
    return true;
  }
}

class ResendEmailProvider implements EmailProvider {
  name = 'resend';
  async send(m: EmailMessage) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: config.emailFrom, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      });
      if (!res.ok) {
        console.error(`[email:resend] lỗi ${res.status}:`, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('[email:resend] không gửi được:', err);
      return false;
    }
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    if (config.emailProvider === 'resend' && !config.resendApiKey) {
      console.warn('[email] EMAIL_PROVIDER=resend nhưng thiếu RESEND_API_KEY -> chuyển sang log');
    }
    provider = config.emailProvider === 'resend' && config.resendApiKey ? new ResendEmailProvider() : new LogEmailProvider();
  }
  return provider;
}
