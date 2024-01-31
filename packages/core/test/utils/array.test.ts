import { expect, it } from "vitest";
import { createPredicate, createQuery, deleteBy, restoreArray } from "../../src/utils/array";

it("mock-query", async () => {
  const query = createQuery<string>();
  query.set(0, "test");
  query.set(1, "test2");
  query.set(2, "test3");

  expect(query.get(0)).toEqual("test");
  expect(query.get(1)).toEqual("test2");
  expect(query.get(2)).toEqual("test3");
  expect(query.get(3)).toEqual(undefined);

  expect(query.length).toEqual(3);

  query.delete(1);

  expect(query.length).toEqual(2);

  query.set(0, "test2");
  query.set(1, "test3");

  expect(query.get(0)).toEqual("test2");
  expect(query.get(1)).toEqual("test3");
  expect(query.get(2)).toEqual(undefined);

  query.clear();

  expect(query.length).toEqual(0);

  query.append(...["test4", "test5", "test6"]);
  expect(query.length).toEqual(3);
  expect(query.get(0)).toEqual("test4");
  expect(query.get(1)).toEqual("test5");
  expect(query.get(2)).toEqual("test6");

  query.reset(createQuery(["test7", "test8", "test9"]));
  expect(query.length).toEqual(3);
  expect(query.get(0)).toEqual("test7");
  expect(query.get(1)).toEqual("test8");
  expect(query.get(2)).toEqual("test9");

  expect(delete query[-1]).toBeTruthy();
  expect(query.length).toEqual(3);
  expect(query[2]).toEqual(undefined);
});

it("mock-query-2", async () => {
  const magnus = { name: "Hedlund, Magnus" };
  const terry = { name: "Adams, Terry" };
  const charlotte = { name: "Weiss, Charlotte" };

  const barley = { name: "Barley", owner: terry };
  const boots = { name: "Boots", owner: terry };
  const whiskers = { name: "Whiskers", owner: charlotte };
  const daisy = { name: "Daisy", owner: magnus };

  const pets = [barley, boots, whiskers, daisy];
  const people = [magnus, terry, charlotte];

  const query = createQuery(people).groupJoin(pets, "name", p => p.owner.name, (person, petCollection) => {
    return {
      name: person.name,
      pets: petCollection.map(pet => pet.name)
    };
  });

  expect(query.length).toEqual(3);
  expect(query[0]).toEqual({ name: "Hedlund, Magnus", pets: ["Daisy"] });
  expect(query[1]).toEqual({ name: "Adams, Terry", pets: ["Barley", "Boots"] });
  expect(query[2]).toEqual({ name: "Weiss, Charlotte", pets: ["Whiskers"] });
});

it("mock-query-math", async () => {
  const query = createQuery([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(query.sum()).toEqual(55);
  expect(query.average()).toEqual(5.5);
  expect(query.min()).toEqual(1);
  expect(query.max()).toEqual(10);
  expect(query.length).toEqual(10);
});

it("mock-query-distinct", async () => {
  const query = createQuery([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(query.distinct().length).toEqual(10);
  const query2 = createQuery([{ name: "test" }, { name: "test2" }, { name: "test" }, { name: "test2" }]);
  expect(query2.distinct("name").toArray()).toEqual([{ name: "test" }, { name: "test2" }]);
});

it("mock-query-where", async () => {
  const query = createQuery([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  expect(query.where(x => x > 5).select().length).toEqual(5);

  query.sort().select();

  const query2 = createQuery([{ name: "test", order: 1 }, { name: "test2", order: 1 }, { name: "test", order: 1 }, { name: "test2", order: 1 }]);
  expect(query2.select("name").toArray()).toEqual(["test", "test2", "test", "test2"]);
  expect(query2.where("order", 1).select("name").toArray()).toEqual(["test", "test2", "test", "test2"]);
});

it("mock-array-deleteBy", async () => {
  expect(deleteBy([1, 2, 3, 4, 5, 6], r => r % 2 === 0)).toSatisfy((r: number[]) => {
    return r.every(r => r % 2 === 1);
  });
});

it("mock-array-restore", async () => {
  const a = [1, 3, 5];
  restoreArray(a, [2, 4, 6]);
  expect(a).toEqual([2, 4, 6]);
});

it("mock-predicate", async () => {
  let predicate = createPredicate((r: number) => r % 2 === 0);
  expect([2, 4, 6].every(predicate)).toBeTruthy();
  expect([2, 4, 6, 7, 14, 21].every(predicate)).toBeFalsy();
  // r % 2 === 0 || r % 7 === 0
  predicate = predicate.or((r: number) => r % 7 === 0);
  expect([2, 4, 6, 7, 14, 21].every(predicate)).toBeTruthy();
  // (r % 2 === 0 || r % 7 === 0) && r % 3 === 0
  predicate = predicate.and((r: number) => r % 3 === 0);
  expect([2, 4, 6, 7, 14, 21].every(predicate)).toBeFalsy();
  expect([6, 12, 18, 21].every(predicate)).toBeTruthy();
});
