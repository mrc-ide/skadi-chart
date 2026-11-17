import { DeepPartialRecord, Prettify, XY } from "@/types";
import { doXYStartEnd } from "@/helpers";
import { ChartConfig, StartEnd } from "../axes/types";

type Dict = Record<string, unknown>

const isPlainObject = (v: unknown): v is Dict =>
  !!v
  && typeof v === "object"
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const assignIfDefined = <
  Obj extends Dict,
  K extends keyof Obj
>(obj: Obj,
  k: K,
  v: Obj[K] | undefined,
) => {
  obj[k] = v === undefined ? obj[k] : v;
}

export const objForEach = <
  Obj extends Dict
>(
  obj: Obj,
  fn: (k: keyof Obj, v: Obj[keyof Obj]) => void
) => {
  Object.entries(obj).forEach(([key, val]) => {
    const k = key as keyof Obj;
    const v = val as Obj[keyof Obj];
    fn(k, v);
  });
};

export const objMap = <
  Obj extends Dict,
  RetVal,
>(
  obj: Obj,
  keyFn: (k: keyof Obj, v: Obj[keyof Obj]) => string,
  valFn: (k: keyof Obj, v: Obj[keyof Obj]) => RetVal,
): Record<string, RetVal> => {
  const entries = Object.entries(obj).map(([key, val]) => {
    const k = key as keyof Obj;
    const v = val as Obj[keyof Obj];
    return [keyFn(k, v), valFn(k, v)];
  });
  return Object.fromEntries(entries);
};

export const objKeys = <Obj extends Dict>(obj: Obj): Prettify<(keyof Obj)[]> =>
  Object.keys(obj);

export const deepAssignRecordIfDefined = <Obj extends Dict>(
  obj1: Obj,
  obj2: DeepPartialRecord<Obj>,
) => {
  objForEach(obj2, k => {
    const v1 = obj1[k];
    const v2 = obj2[k];

    if (isPlainObject(v2)) {
      deepAssignRecordIfDefined<Dict>(v1 as Dict, v2);
      assignIfDefined(obj1, k, v1);
    } else {
      assignIfDefined(obj1, k, v2);
    }
  });
}

type PartialObj = Partial<XY<
  Partial<StartEnd<any[]>>
>>

export const mergeChartArgs = (
  chart: ChartConfig,
  partial: PartialObj,
) => {
  doXYStartEnd((ax, pos) => {
    const axCfg = partial[ax];
    if (!axCfg) return;
    
    const posCfg = axCfg[pos];
    if (!posCfg) return;

    posCfg.forEach(
      (cfg, i) => deepAssignRecordIfDefined(chart[ax][pos][i], cfg)
    );
  });
};
