import "@fourze/core";

declare module "@fourze/core" {
  interface FourzeRouteMeta {
    title?: string;
  }
  interface GlobalProps {
    title?: string;
  }
}
