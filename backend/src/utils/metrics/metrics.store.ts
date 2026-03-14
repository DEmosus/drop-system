interface MetricsStore {
  totalReservations: number;
  failedReservations: number;
  expiredReservations: number;
  completedCheckouts: number;
  cancelledReservations: number;
  totalRequests: number;
  requestsByRoute: Record<string, number>;
  startTime: Date;
}

const store: MetricsStore = {
  totalReservations: 0,
  failedReservations: 0,
  expiredReservations: 0,
  completedCheckouts: 0,
  cancelledReservations: 0,
  totalRequests: 0,
  requestsByRoute: {},
  startTime: new Date(),
};

export const metricsStore = {
  increment(
    key: keyof Omit<MetricsStore, "requestsByRoute" | "startTime">,
  ): void {
    (store[key] as number)++;
  },

  incrementRoute(route: string): void {
    store.requestsByRoute[route] = (store.requestsByRoute[route] ?? 0) + 1;
    store.totalRequests++;
  },

  snapshot(): MetricsStore & { uptimeSeconds: number } {
    return {
      ...store,
      requestsByRoute: { ...store.requestsByRoute },
      uptimeSeconds: Math.floor(
        (Date.now() - store.startTime.getTime()) / 1000,
      ),
    };
  },

  reset(): void {
    store.totalReservations = 0;
    store.failedReservations = 0;
    store.expiredReservations = 0;
    store.completedCheckouts = 0;
    store.cancelledReservations = 0;
    store.totalRequests = 0;
    store.requestsByRoute = {};
  },
};
