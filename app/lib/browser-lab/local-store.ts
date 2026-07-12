export type DeviceLocalStore<T> = {
  load: () => T;
  save: (value: T) => T;
  update: (update: (value: T) => T) => T;
  subscribe: (listener: () => void) => () => void;
};

export function createDeviceLocalStore<T>({
  key,
  changeEvent,
  empty,
  sanitize,
}: {
  key: string;
  changeEvent: string;
  empty: () => T;
  sanitize: (value: unknown) => T;
}): DeviceLocalStore<T> {
  const load = () => {
    if (typeof window === "undefined") return empty();
    try {
      const serialized = window.localStorage.getItem(key);
      return serialized ? sanitize(JSON.parse(serialized)) : empty();
    } catch {
      return empty();
    }
  };
  const save = (value: T) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent(changeEvent));
    }
    return value;
  };
  const update = (updater: (value: T) => T) => save(updater(load()));
  const subscribe = (listener: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(changeEvent, listener);
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener(changeEvent, listener);
      window.removeEventListener("storage", listener);
    };
  };
  return { load, save, update, subscribe };
}
