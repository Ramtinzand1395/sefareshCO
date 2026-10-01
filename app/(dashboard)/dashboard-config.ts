export type DashboardPortal = "cafe" | "supplier" | "admin";

export type DashboardIconName =
  | "dashboard"
  | "shopping-list"
  | "request"
  | "compare"
  | "cart"
  | "orders"
  | "suppliers"
  | "members"
  | "internal-request"
  | "payments"
  | "settings"
  | "offers"
  | "products"
  | "finance"
  | "transactions"
  | "settlements"
  | "business"
  | "cafes"
  | "users"
  | "catalog"
  | "categories"
  | "reports"
  | "notifications";

export type DashboardNavigationLink = {
  type: "link";
  label: string;
  href: string;
  description: string;
  icon: DashboardIconName;
};

export type DashboardNavigationGroup = {
  type: "group";
  label: string;
  icon: DashboardIconName;
  children: DashboardNavigationLink[];
};

export type DashboardNavigationItem =
  | DashboardNavigationLink
  | DashboardNavigationGroup;

type DetailRoute = {
  pattern: string;
  title: string;
  description: string;
  parentHref: string;
};

type DashboardPortalConfig = {
  label: string;
  shortLabel: string;
  basePath: `/${DashboardPortal}`;
  accountHref: string;
  navigation: DashboardNavigationItem[];
  details: DetailRoute[];
};

function link(
  label: string,
  href: string,
  description: string,
  icon: DashboardIconName,
): DashboardNavigationLink {
  return { type: "link", label, href, description, icon };
}

export const dashboardPortals = {
  cafe: {
    label: "پنل کافه و رستوران",
    shortLabel: "پنل کافه",
    basePath: "/cafe",
    accountHref: "/cafe/settings/account",
    navigation: [
      link("داشبورد", "/cafe", "نمای کلی فضای خرید و فعالیت‌های کافه", "dashboard"),
      link(
        "لیست خرید",
        "/cafe/shopping-list",
        "مواد اولیه موردنیاز مجموعه را در یک فهرست نگه دارید.",
        "shopping-list",
      ),
      link(
        "استعلام‌های قیمت",
        "/cafe/purchase-requests",
        "استعلام‌های قیمت مجموعه را ایجاد و پیگیری کنید.",
        "request",
      ),
      link(
        "کاتالوگ کالاها",
        "/cafe/products",
        "محصولات دارای عرضه فعال و قیمت‌های تأمین‌کنندگان را مرور کنید.",
        "products",
      ),
      link(
        "مقایسه قیمت‌ها",
        "/cafe/compare",
        "پیشنهادهای تأمین‌کنندگان را مستقل از سبد خرید مقایسه کنید.",
        "compare",
      ),
      link("سبد خرید", "/cafe/cart", "اقلام آماده سفارش کافه را مرور کنید.", "cart"),
      link(
        "سفارش‌های من",
        "/cafe/orders",
        "سفارش‌های ثبت‌شده برای این کافه را پیگیری کنید.",
        "orders",
      ),
      link(
        "تأمین‌کنندگان",
        "/cafe/suppliers",
        "تأمین‌کنندگان فعال Marketplace را مشاهده کنید.",
        "suppliers",
      ),
      link(
        "اعضای مجموعه",
        "/cafe/members",
        "اعضا، نقش‌ها و سطح دسترسی مجموعه را مدیریت کنید.",
        "members",
      ),
      link(
        "درخواست‌های داخلی",
        "/cafe/internal-requests",
        "درخواست‌های خرید داخلی اعضای کافه را بررسی کنید.",
        "internal-request",
      ),
      link(
        "پرداخت‌ها",
        "/cafe/payments",
        "وضعیت پرداخت‌های متعلق به این کافه را مشاهده کنید.",
        "payments",
      ),
      {
        type: "group",
        label: "تنظیمات",
        icon: "settings",
        children: [
          link(
            "پروفایل",
            "/cafe/settings/profile",
            "اطلاعات فردی و نمایه خود را ویرایش کنید.",
            "users",
          ),
          link(
            "اطلاعات کسب‌وکار",
            "/cafe/settings/business",
            "اطلاعات کافه یا رستوران را مدیریت کنید.",
            "business",
          ),
          link(
            "اعلان‌ها",
            "/cafe/settings/notifications",
            "ترجیحات اعلان‌های فضای کافه را تنظیم کنید.",
            "notifications",
          ),
          link(
            "حساب کاربری",
            "/cafe/settings/account",
            "تنظیمات امنیتی و حساب کاربری را مدیریت کنید.",
            "settings",
          ),
        ],
      },
    ],
    details: [
      {
        pattern: "/cafe/purchase-requests/[id]",
        title: "جزئیات استعلام قیمت",
        description: "اقلام، زمان‌بندی و وضعیت استعلام قیمت در این بخش نمایش داده می‌شود.",
        parentHref: "/cafe/purchase-requests",
      },
      {
        pattern: "/cafe/orders/[id]",
        title: "جزئیات سفارش",
        description: "اطلاعات، وضعیت و رویدادهای سفارش کافه در این بخش نمایش داده می‌شود.",
        parentHref: "/cafe/orders",
      },
      {
        pattern: "/cafe/internal-requests/[id]",
        title: "جزئیات درخواست داخلی",
        description: "جزئیات درخواست داخلی و فرایند تأیید مدیر مجموعه در این بخش نمایش داده می‌شود.",
        parentHref: "/cafe/internal-requests",
      },
    ],
  },
  supplier: {
    label: "پنل تأمین‌کننده",
    shortLabel: "پنل تأمین‌کننده",
    basePath: "/supplier",
    accountHref: "/supplier/settings/account",
    navigation: [
      link("داشبورد", "/supplier", "نمای کلی فعالیت‌های تأمین‌کننده", "dashboard"),
      link(
        "درخواست‌های دریافتی",
        "/supplier/requests",
        "فقط درخواست‌های تخصیص‌یافته به تأمین‌کننده جاری را مشاهده کنید.",
        "request",
      ),
      link(
        "پیشنهادهای من",
        "/supplier/offers",
        "پیشنهادهای قیمت ثبت‌شده توسط این تأمین‌کننده را مدیریت کنید.",
        "offers",
      ),
      link(
        "محصولات",
        "/supplier/products",
        "محصولات Marketplace و پیشنهادهای مرتبط خود را مدیریت کنید.",
        "products",
      ),
      link(
        "سفارش‌ها",
        "/supplier/orders",
        "فقط سفارش‌های متعلق به تأمین‌کننده جاری را پیگیری کنید.",
        "orders",
      ),
      {
        type: "group",
        label: "مالی",
        icon: "finance",
        children: [
          link(
            "خلاصه مالی",
            "/supplier/finance",
            "نمای کلی وضعیت مالی تأمین‌کننده را مشاهده کنید.",
            "finance",
          ),
          link(
            "تراکنش‌ها",
            "/supplier/finance/transactions",
            "تراکنش‌های متعلق به تأمین‌کننده را مرور کنید.",
            "transactions",
          ),
          link(
            "تسویه‌ها",
            "/supplier/finance/settlements",
            "سوابق و وضعیت تسویه‌های تأمین‌کننده را پیگیری کنید.",
            "settlements",
          ),
        ],
      },
      link(
        "پروفایل کسب‌وکار",
        "/supplier/business-profile",
        "مشخصات تجاری و اطلاعات حقوقی تأمین‌کننده را مدیریت کنید.",
        "business",
      ),
      {
        type: "group",
        label: "تنظیمات",
        icon: "settings",
        children: [
          link(
            "حساب کاربری",
            "/supplier/settings/account",
            "تنظیمات امنیتی و حساب کاربری را مدیریت کنید.",
            "users",
          ),
          link(
            "اعلان‌ها",
            "/supplier/settings/notifications",
            "ترجیحات اعلان‌های تأمین‌کننده را تنظیم کنید.",
            "notifications",
          ),
          link(
            "تنظیمات عمومی",
            "/supplier/settings/general",
            "تنظیمات عمومی فضای تأمین‌کننده را مدیریت کنید.",
            "settings",
          ),
        ],
      },
    ],
    details: [
      {
        pattern: "/supplier/requests/[id]",
        title: "جزئیات درخواست دریافتی",
        description: "جزئیات SupplierRequest تخصیص‌یافته به این تأمین‌کننده نمایش داده می‌شود.",
        parentHref: "/supplier/requests",
      },
      {
        pattern: "/supplier/orders/[id]",
        title: "جزئیات سفارش",
        description: "جزئیات سفارش متعلق به تأمین‌کننده جاری در این بخش نمایش داده می‌شود.",
        parentHref: "/supplier/orders",
      },
    ],
  },
  admin: {
    label: "پنل مدیریت Marketplace",
    shortLabel: "پنل ادمین",
    basePath: "/admin",
    accountHref: "/admin/settings/general",
    navigation: [
      link("داشبورد", "/admin", "نمای کلی وضعیت Marketplace", "dashboard"),
      link("کافه‌ها", "/admin/cafes", "کافه‌ها و رستوران‌های عضو را مدیریت کنید.", "cafes"),
      link(
        "تأمین‌کنندگان",
        "/admin/suppliers",
        "تأمین‌کنندگان و وضعیت فعالیت آن‌ها را مدیریت کنید.",
        "suppliers",
      ),
      link("کاربران", "/admin/users", "کاربران پلتفرم را مشاهده و مدیریت کنید.", "users"),
      {
        type: "group",
        label: "کاتالوگ",
        icon: "catalog",
        children: [
          link("محصولات", "/admin/catalog/products", "محصولات کاتالوگ را مدیریت کنید.", "products"),
          link(
            "دسته‌بندی‌ها",
            "/admin/catalog/categories",
            "ساختار دسته‌بندی محصولات را مدیریت کنید.",
            "categories",
          ),
        ],
      },
      link(
        "درخواست‌های خرید",
        "/admin/purchase-requests",
        "PurchaseRequestهای Marketplace را مشاهده کنید.",
        "request",
      ),
      link(
        "درخواست‌های تأمین‌کنندگان",
        "/admin/supplier-requests",
        "SupplierRequestها و نتیجه Matching را مشاهده کنید.",
        "internal-request",
      ),
      link("سفارش‌ها", "/admin/orders", "سفارش‌های Marketplace را پایش کنید.", "orders"),
      {
        type: "group",
        label: "مالی",
        icon: "finance",
        children: [
          link("پرداخت‌ها", "/admin/finance/payments", "پرداخت‌های پلتفرم را مشاهده کنید.", "payments"),
          link(
            "تراکنش‌ها",
            "/admin/finance/transactions",
            "تراکنش‌های مالی Marketplace را مرور کنید.",
            "transactions",
          ),
          link(
            "تسویه‌ها",
            "/admin/finance/settlements",
            "تسویه‌های تأمین‌کنندگان را مدیریت کنید.",
            "settlements",
          ),
        ],
      },
      link("گزارش‌ها", "/admin/reports", "گزارش‌های مدیریتی Marketplace را مشاهده کنید.", "reports"),
      {
        type: "group",
        label: "تنظیمات سیستم",
        icon: "settings",
        children: [
          link(
            "تنظیمات عمومی",
            "/admin/settings/general",
            "تنظیمات پایه سیستم را مدیریت کنید.",
            "settings",
          ),
          link(
            "تنظیمات Marketplace",
            "/admin/settings/marketplace",
            "قواعد و تنظیمات Marketplace را مدیریت کنید.",
            "catalog",
          ),
          link(
            "اعلان‌ها",
            "/admin/settings/notifications",
            "تنظیمات اعلان‌های سیستمی را مدیریت کنید.",
            "notifications",
          ),
        ],
      },
    ],
    details: [
      {
        pattern: "/admin/cafes/[id]",
        title: "جزئیات کافه",
        description: "اطلاعات و وضعیت کافه یا رستوران انتخاب‌شده نمایش داده می‌شود.",
        parentHref: "/admin/cafes",
      },
      {
        pattern: "/admin/suppliers/[id]",
        title: "جزئیات تأمین‌کننده",
        description: "اطلاعات و وضعیت تأمین‌کننده انتخاب‌شده نمایش داده می‌شود.",
        parentHref: "/admin/suppliers",
      },
      {
        pattern: "/admin/users/[id]",
        title: "جزئیات کاربر",
        description: "اطلاعات حساب و ارتباط کاربر با کسب‌وکارها نمایش داده می‌شود.",
        parentHref: "/admin/users",
      },
    ],
  },
} satisfies Record<DashboardPortal, DashboardPortalConfig>;

export type ResolvedDashboardRoute = {
  title: string;
  description: string;
  parentHref?: string;
  identifier?: string;
};

export function getDashboardLinks(items: DashboardNavigationItem[]) {
  return items.flatMap((item) =>
    item.type === "group" ? item.children : [item],
  );
}

function matchesPattern(pathname: string, pattern: string) {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every(
    (part, index) =>
      (part.startsWith("[") && part.endsWith("]")) || part === pathParts[index],
  );
}

export function resolveDashboardRoute(
  portal: DashboardPortal,
  pathname: string,
): ResolvedDashboardRoute | null {
  const config = dashboardPortals[portal];
  const staticRoute = getDashboardLinks(config.navigation).find(
    (item) => item.href === pathname,
  );

  if (staticRoute) {
    return {
      title: staticRoute.label,
      description: staticRoute.description,
    };
  }

  const detailRoute = config.details.find((item) =>
    matchesPattern(pathname, item.pattern),
  );
  if (!detailRoute) return null;

  const identifier = pathname.split("/").filter(Boolean).at(-1);
  return {
    title: detailRoute.title,
    description: detailRoute.description,
    parentHref: detailRoute.parentHref,
    identifier,
  };
}

export function getActiveNavigationHref(
  portal: DashboardPortal,
  pathname: string,
) {
  const links = getDashboardLinks(dashboardPortals[portal].navigation);
  const matches = links.filter((item) => {
    if (item.href === dashboardPortals[portal].basePath) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  return matches.sort((a, b) => b.href.length - a.href.length).at(0)?.href;
}
