// js/admin-guard.js
function waitForSB(cb, tries = 60) {
  if (window.sb) return cb();
  if (tries <= 0) return console.error("[admin-guard] sb not ready");
  setTimeout(() => waitForSB(cb, tries - 1), 100);
}

async function guardAdminPage() {
  try {
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;
    if (!user) {
      location.replace("../index.html?need_login=1");
      return;
    }

    const { data, error } = await sb
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      location.replace("../index.html");
      return;
    }

    // 通過 → 顯示內容
    document.documentElement.removeAttribute("data-guard");
  } catch (err) {
    console.error("[admin-guard] error:", err);
    location.replace("../index.html");
  }
}

waitForSB(guardAdminPage);

