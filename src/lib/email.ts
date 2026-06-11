import { Resend } from "resend";

const FROM = "rekōdo <hello@rekodo.co>";
const ADMIN = "hello@rekodo.co";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendWaitlistConfirmation(email: string, name?: string | null) {
  const resend = getResend();
  const greeting = name ? `Hi ${name},` : "Hi,";

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "you're on the list — rekōdo",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:60px 24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:48px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#CC5500;">
                rekōdo
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.4;color:#ffffff;">
                ${greeting}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;line-height:1.8;color:rgba(255,255,255,0.6);">
                You're on the waitlist for rekōdo — a place to catalogue your records, share what you love, and find collectors who hear what you hear.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:48px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;line-height:1.8;color:rgba(255,255,255,0.6);">
                We're in private beta and opening spots carefully. When yours is ready, we'll be in touch.
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:32px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;color:rgba(255,255,255,0.25);">
                rekodo.co
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendWaitlistNotification(email: string, name?: string | null) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `new waitlist signup — ${email}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:48px 24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:32px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#CC5500;">
                waitlist
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                email
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${email}
              </p>
            </td>
          </tr>
          ${name ? `<tr>
            <td style="padding-bottom:8px;padding-top:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                name
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${name}
              </p>
            </td>
          </tr>` : ""}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}
