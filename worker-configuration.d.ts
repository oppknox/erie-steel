interface Env {
  ROOMS: DurableObjectNamespace<import("./src/room").GameRoom>;
  ASSETS: Fetcher;
}
