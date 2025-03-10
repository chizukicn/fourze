import { CollectionQueryClass, createQuery } from "@fourze/core";
import { suite } from "../lib/suite";

const source = Array.from({ length: 100 }).fill(0).map((_, i) => i);

suite("query-func", 100000, () => {
  const query = createQuery<number>(source);
  query.where((i) => i % 2 === 0).select((i) => i * 2);
});

suite("query-class", 100000, () => {
  const query = new CollectionQueryClass<number>(source);
  query.where((i) => i % 2 === 0).select((i) => i * 2);
});

suite("array", 100000, () => {
  const array = Array.from(source);
  array.filter((i) => i % 2 === 0).map((i) => i * 2);
});
