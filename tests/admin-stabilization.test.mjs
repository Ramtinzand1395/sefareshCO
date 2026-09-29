import assert from "node:assert/strict";
import test from "node:test";

import { Types } from "mongoose";

import { Supplier } from "../model/supplier.ts";
import {
  hasActiveBusinessAccess,
  isActiveAdmin,
} from "../src/domain/admin-access.ts";
import { adminEntityIdSchema } from "../src/domain/schemas/admin-common.ts";
import { matchedExistingDocument } from "../src/repositories/update-result.ts";

test("pending admin is not authorized", () => {
  assert.equal(isActiveAdmin({ isAdmin: true, status: "pending" }), false);
  assert.equal(isActiveAdmin({ isAdmin: true, status: "active" }), true);
});

test("suspended business blocks an otherwise active member", () => {
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "suspended",
    }),
    false,
  );
  assert.equal(
    hasActiveBusinessAccess({
      userStatus: "active",
      membershipStatus: "active",
      businessStatus: "active",
    }),
    true,
  );
});

test("Supplier stores verifiedByAdminId as a User ObjectId", async () => {
  const path = Supplier.schema.path("verifiedByAdminId");
  assert.equal(path.instance, "ObjectId");
  assert.equal(path.options.ref, "User");

  const adminId = new Types.ObjectId();
  const supplier = new Supplier({
    ownerUserId: new Types.ObjectId(),
    businessName: "Test supplier",
    verifiedByAdminId: adminId.toString(),
  });

  await supplier.validate();
  assert.equal(supplier.verifiedByAdminId.toString(), adminId.toString());
});

test("updating to the current status is a successful no-op", () => {
  assert.equal(
    matchedExistingDocument({ matchedCount: 1, modifiedCount: 0 }),
    true,
  );
  assert.equal(
    matchedExistingDocument({ matchedCount: 0, modifiedCount: 0 }),
    false,
  );
});

test("invalid identifiers are rejected before persistence", () => {
  assert.equal(adminEntityIdSchema.safeParse("not-an-object-id").success, false);
  assert.equal(adminEntityIdSchema.safeParse("").success, false);
  assert.equal(
    adminEntityIdSchema.safeParse(new Types.ObjectId().toString()).success,
    true,
  );
});
