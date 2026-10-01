import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// فقط برای سازگاری با داده‌های development قدیمی نگه داشته شده است.
// مجوز و tenant از Membershipها resolve می‌شوند، نه از این فیلد.
export type LegacyUserRole = "cafe" | "supplier" | "admin";

export type UserStatus = "active" | "pending" | "suspended" | "disabled";

const userSchema = new Schema(
  {
    // اطلاعات پایه
    firstName: {
      type: String,
      trim: true,
      maxlength: 80,
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: 80,
    },

    mobile: {
      type: String,
      unique: true,
      trim: true,
      index: true,
      sparse: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },

    // اگر احراز هویت با پسورد باشد
    passwordHash: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ["cafe", "supplier", "admin"],
      index: true,
      select: false,
    },

    status: {
      type: String,
      enum: ["active", "pending", "suspended", "disabled"],
      default: "pending",
      index: true,
    },

    // تایید شماره موبایل
    mobileVerified: {
      type: Boolean,
      default: false,
    },

    mobileVerifiedAt: {
      type: Date,
    },

    // ایمیل اختیاری
    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
    },

    authProviders: [
      {
        _id: false,
        provider: {
          type: String,
          enum: ["credentials", "google"],
          required: true,
        },
        providerAccountId: {
          type: String,
          trim: true,
        },
        linkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    avatarUrl: {
      type: String,
      trim: true,
    },

    lastLoginAt: {
      type: Date,
    },

    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    onboardingCompletedAt: {
      type: Date,
    },

    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },

    // قفل کوتاه‌مدت برای idempotency در deploymentهای بدون transaction.
    onboardingLock: {
      type: String,
      select: false,
    },

    onboardingLockExpiresAt: {
      type: Date,
      select: false,
    },

    // کنترل امنیتی
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockedUntil: {
      type: Date,
    },

    // برای soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  {
    "authProviders.providerAccountId": 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

export const User = models.User || model("User", userSchema);
