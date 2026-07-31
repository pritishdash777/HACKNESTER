// netlify/functions/waitlist.js
const { createClient } = require("@supabase/supabase-js");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Please enter a valid university email." }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "HackNester <onboarding@resend.dev>";

    if (!supabaseUrl || !supabaseServiceKey || !resendKey || !adminEmail) {
      console.error("[waitlist] Missing env vars");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Server configuration error." }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert into waitlist (ignore exact duplicate)
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert([{ email: cleanEmail }]);

    if (insertError) {
      // Postgres unique violation
      if (insertError.code === "23505") {
        // Still send a friendly confirmation so the user isn't confused
      } else {
        console.error("[waitlist] insert error:", insertError);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Could not save your email. Please try again." }),
        };
      }
    }

    // ── Confirmation email to the student ──────────────────────────────
    const userHtml = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.6">
        <h2 style="margin-bottom:8px">Welcome to HackNester 🚀</h2>
        <p>Hi there,</p>
        <p>Thanks for joining the HackNester Early Access list.</p>
        <p>We're building a platform where students can:</p>
        <ul>
          <li>Find teammates</li>
          <li>Build projects</li>
          <li>Join hackathons</li>
          <li>Launch startups</li>
        </ul>
        <p>You'll be among the first to know when we launch new features.</p>
        <p style="margin-top:28px">– Pritish Dash<br><strong>Founder, HackNester</strong></p>
      </div>
    `;

    const userRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanEmail],
        subject: "Welcome to HackNester 🚀",
        html: userHtml,
      }),
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("[waitlist] Resend user email failed:", errText);
      // Don't fail the whole request — email is already saved
    }

    // ── Notification email to you (admin) ──────────────────────────────
    const adminHtml = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.6">
        <h2>New Early Access signup</h2>
        <p><strong>Email:</strong> ${cleanEmail}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      </div>
    `;

    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `New HackNester waitlist signup: ${cleanEmail}`,
        html: adminHtml,
      }),
    });

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      console.error("[waitlist] Resend admin email failed:", errText);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("[waitlist] unexpected error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Something went wrong. Please try again." }),
    };
  }
};