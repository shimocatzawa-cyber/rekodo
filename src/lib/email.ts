import { Resend } from "resend";

const FROM = "rekōdo <hello@rekodo.co>";
const ADMIN = "hello@rekodo.co";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}


export async function sendSignupNotification(email: string, username: string) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `new signup — ${username}`,
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
                new user
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                username
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                @${username}
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
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendNewSupporterAlert(opts: {
  email: string;
  amountCents: number;
  currency: string;
}) {
  const resend = getResend();
  const { email, amountCents, currency } = opts;
  const sym = currency === "gbp" ? "£" : currency === "eur" ? "€" : currency === "aud" ? "A$" : "$";
  const amount = `${sym}${(amountCents / 100).toFixed(2)}`;
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `new supporter — ${email}`,
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
                new supporter
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                email
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${email}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                amount
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${amount}
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

export async function sendWaitlistNotification(email: string, name?: string) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `waitlist — ${email}`,
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
                waitlist signup
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                email
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${email}
              </p>
            </td>
          </tr>
          ${name ? `<tr>
            <td style="padding-bottom:8px;">
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

export async function sendAccountDeletionAlert(opts: {
  userId: string;
  email: string;
  username: string;
  displayName?: string | null;
  subscriptionTier?: string | null;
  createdAt?: string | null;
}) {
  const resend = getResend();
  const { userId, email, username, displayName, subscriptionTier, createdAt } = opts;
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `account deleted — @${username}`,
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
                account deleted
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                username
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                @${username}${displayName ? ` (${displayName})` : ""}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                email
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${email}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                user id
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:12px;color:rgba(255,255,255,0.6);">
                ${userId}
              </p>
            </td>
          </tr>
          ${subscriptionTier ? `<tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                subscription
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${subscriptionTier}
              </p>
            </td>
          </tr>` : ""}
          ${createdAt ? `<tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                member since
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
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

