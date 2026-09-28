"use client";

import { motion, useReducedMotion } from "motion/react";
import { IconMilk } from "@tabler/icons-react";

const suppliers = [
  {
    name: "تأمین کرمان",
    product: "شیر کم‌چرب پگاه یک لیتری",
    price: "۱۳۲,۰۰۰",
    delivery: "۲ روز",
    shipping: "۲۵,۰۰۰",
    updated: "امروز ۱۱:۲۰",
  },
  {
    name: "زرین تجارت",
    product: "شیر کم‌چرب پگاه یک لیتری",
    price: "۱۲۵,۰۰۰",
    delivery: "فردا",
    shipping: "۱۵,۰۰۰",
    updated: "امروز ۰۹:۱۵",
  },
  {
    name: "پخش بهار",
    product: "شیر کم‌چرب پگاه یک لیتری",
    price: "۱۳۰,۰۰۰",
    delivery: "۲ روز",
    shipping: "۲۰,۰۰۰",
    updated: "امروز ۱۰:۳۵",
  },
];

export function SupplierComparison() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {suppliers.map((supplier) => (
        <motion.div
          key={supplier.name}
          whileHover={reduceMotion ? undefined : { y: -4 }}
          className="relative rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <IconMilk size={30} stroke={1.7} />
            </span>

            <span>
              <strong className="block text-base text-slate-950">
                {supplier.name}
              </strong>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {supplier.product}
              </span>
            </span>
          </div>

          <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">قیمت واحد</dt>
              <dd className="font-bold text-slate-950">
                {supplier.price} تومان
              </dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">هزینه ارسال</dt>
              <dd>{supplier.shipping} تومان</dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">زمان تحویل</dt>
              <dd>{supplier.delivery}</dd>
            </div>

            <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
              <dt className="text-slate-400">آخرین به‌روزرسانی</dt>
              <dd className="text-slate-600">{supplier.updated}</dd>
            </div>
          </dl>
        </motion.div>
      ))}
    </div>
  );
}
