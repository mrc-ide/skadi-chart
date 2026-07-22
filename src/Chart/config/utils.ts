import { DeepPartialRecord } from "@/types";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v
  && typeof v === "object"
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const assignIfDefined = <
  Obj extends Record<string, unknown>,
  K extends keyof Obj
>(obj: Obj,
  k: K,
  v: Obj[K] | undefined,
) => {
  obj[k] = v === undefined ? obj[k] : v;
}

export const deepAssignRecordIfDefined = <Obj extends Record<string, unknown>>(
  obj1: Obj,
  obj2: DeepPartialRecord<Obj>,
) => {
  for (const k of Object.keys(obj2) as Array<keyof Obj>) {
    const v1 = obj1[k];
    const v2 = obj2[k];

    if (isPlainObject(v2)) {
      deepAssignRecordIfDefined<Record<string, unknown>>(v1 as Record<string, unknown>, v2);
      assignIfDefined(obj1, k, v1);
    } else {
      assignIfDefined(obj1, k, v2);
    }
  }
}
