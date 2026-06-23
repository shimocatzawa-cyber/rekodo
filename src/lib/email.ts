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

export async function sendWelcomeEmail(email: string, username: string) {
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "you're in — rekōdo",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>rekōdo — You're in</title>
</head>
<body style="margin:0; padding:0; background-color:#FDF6F0; font-family: Georgia, 'Times New Roman', serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF6F0;">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FDF6F0;">

        <!-- WORDMARK -->
        <tr>
          <td style="padding: 0 0 32px 0; border-bottom: 1px solid #e0e0da;">
            <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; color: #0a0a0a; letter-spacing: -0.01em;">
              rek<span style="color:#CC5500;">ō</span>do
            </span>
          </td>
        </tr>

        <!-- EYEBROW -->
        <tr>
          <td style="padding: 32px 0 0 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #CC5500;">
              Welcome
            </span>
          </td>
        </tr>

        <!-- HEADLINE -->
        <tr>
          <td style="padding: 14px 0 20px 0;">
            <span style="font-family: Georgia, serif; font-size: 30px; font-weight: bold; line-height: 1.2; letter-spacing: -0.02em; color: #0a0a0a;">
              You're in, @${username}.
            </span>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding: 0 0 28px 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
            Your account is set up. Here's where to start:
          </td>
        </tr>

        <!-- CALLOUT: COLLECTION -->
        <tr>
          <td style="padding: 0 0 20px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #CC5500;">
              Collection
            </span>
            <br>
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
              Upload your records and start building your collection.
            </span>
          </td>
        </tr>

        <!-- CALLOUT: DIG -->
        <tr>
          <td style="padding: 0 0 20px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #CC5500;">
              Dig
            </span>
            <br>
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
              Get new music recommendations based on your taste.
            </span>
          </td>
        </tr>

        <!-- CALLOUT: LISTS -->
        <tr>
          <td style="padding: 0 0 28px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #CC5500;">
              Lists
            </span>
            <br>
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
              Create your first list to share what you're into.
            </span>
          </td>
        </tr>

        <!-- CTA BUTTON -->
        <tr>
          <td style="padding: 0 0 28px 0;" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#0a0a0a; border-radius: 0;">
                  <a href="https://rekodo.co/collection" style="display:inline-block; padding: 14px 28px; font-family: 'Courier New', Courier, monospace; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #FDF6F0; text-decoration: none;">
                    Get started → rekodo.co
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY 2 -->
        <tr>
          <td style="padding: 0 0 28px 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
            One honest note: rekōdo is still early. Most things work well, a few edges are rough, and I'm building quickly. If something breaks or looks off, just reply to this email — I read every one.
          </td>
        </tr>

        <!-- SIGNOFF -->
        <tr>
          <td style="padding: 0 0 40px 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 1.7; color: #0a0a0a;">
            Thanks
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding: 24px 0 0 0; border-top: 1px solid #e0e0da; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.6; color: #999;">
            rekōdo · rekodo.co<br>
            You're receiving this because you created an account at rekodo.co.
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

export async function sendWaitlistNotification(email: string, name?: string | null, estCollectionSize?: number) {
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
          ${typeof estCollectionSize === "number" ? `<tr>
            <td style="padding-bottom:8px;padding-top:16px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);">
                est. collection size
              </p>
              <p style="margin:4px 0 0;font-family:'Courier New',monospace;font-size:14px;color:#ffffff;">
                ${estCollectionSize}
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
