const { GameSession, countsToText } = require("../src/engine/gameSession");
const { TILE_ORDER, tileToIndex, parseTiles } = require("../src/engine/mahjong");

function findTile(name) {
  const idx = TILE_ORDER.indexOf(name);
  if (idx === -1) throw new Error(`Unknown tile: ${name}`);
  return idx;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

console.log("\n=== GameSession Tests ===\n");

// Test 1: Basic construction and snapshot
console.log("[1] Construction from counts");
{
  const hand = parseTiles("123m 456p EEN");
  const session = new GameSession(hand, [], 0);
  const snap = session.getSnapshot();
  assert(snap.handText === "123m 456p EEN", `handText = "${snap.handText}"`);
  assert(snap.meldText === "", `meldText = "${snap.meldText}"`);
  assert(snap.deadText === "", `deadText = "${snap.deadText}"`);
  assert(session.getHandCount() === 9, `handCount = ${session.getHandCount()}`);
}

// Test 2: fromText factory
console.log("\n[2] fromText factory");
{
  const session = GameSession.fromText("123m 456p EEN", "EEE", 2);
  const snap = session.getSnapshot();
  assert(snap.handText === "123m 456p EEN", `handText = "${snap.handText}"`);
  assert(snap.meldText === "EEE", `meldText = "${snap.meldText}"`);
  assert(session.flowerCount === 2, `flowerCount = ${session.flowerCount}`);
}

// Test 3: Draw and discard cycle
console.log("\n[3] Draw + Discard cycle");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);
  assert(session.getHandCount() === 13, `initial hand = ${session.getHandCount()}`);

  // Draw 1m
  const result = session.draw(findTile("1m"));
  assert(session.getHandCount() === 14, `after draw = ${session.getHandCount()}`);
  assert(result.concealedCount === 14, `result.concealedCount = ${result.concealedCount}`);
  assert(session.turn === 1, `turn = ${session.turn}`);

  // Discard 1m
  session.discard(findTile("1m"));
  assert(session.getHandCount() === 13, `after discard = ${session.getHandCount()}`);
  assert(session.dead[findTile("1m")] === 1, `dead 1m = ${session.dead[findTile("1m")]}`);
}

// Test 4: Opponent discard tracking
console.log("\n[4] Opponent discard tracking");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);
  session.recordOpponentDiscard(findTile("N"));
  session.recordOpponentDiscard(findTile("N"));
  assert(session.dead[findTile("N")] === 2, `dead N = ${session.dead[findTile("N")]}`);

  const avail = session.getAvailability();
  assert(avail[findTile("N")] === 0, `availability N = ${avail[findTile("N")]}`);

  session.recordOpponentDiscard(findTile("C"));
  assert(session.flowerCount === 0, `self flowerCount after C = ${session.flowerCount}`);
  assert(
    session.observedOpponentFlowerCount === 1,
    `opponent flowerCount after C = ${session.observedOpponentFlowerCount}`
  );
}

// Test 5: Undo
console.log("\n[5] Undo");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);
  session.draw(findTile("1m"));
  assert(session.getHandCount() === 14, `after draw = ${session.getHandCount()}`);

  session.undo();
  assert(session.getHandCount() === 13, `after undo = ${session.getHandCount()}`);
  assert(session.turn === 0, `turn after undo = ${session.turn}`);
}

// Test 6: Multiple undo
console.log("\n[6] Multiple undo steps");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);
  session.draw(findTile("1m"));
  session.discard(findTile("1m"));
  session.recordOpponentDiscard(findTile("S"));

  assert(session.dead[findTile("1m")] === 1, `dead 1m before undo = 1`);
  assert(session.dead[findTile("S")] === 1, `dead S before undo = 1`);

  session.undo(); // undo opponent discard
  assert(session.dead[findTile("S")] === 0, `dead S after 1st undo = 0`);

  session.undo(); // undo discard
  assert(session.getHandCount() === 14, `hand after 2nd undo = 14`);
  assert(session.dead[findTile("1m")] === 0, `dead 1m after 2nd undo = 0`);

  session.undo(); // undo draw
  assert(session.getHandCount() === 13, `hand after 3rd undo = 13`);
}

// Test 7: Tile overflow detection
console.log("\n[7] Tile overflow detection");
{
  const session = GameSession.fromText("1111m", "", 0);
  let caught = false;
  try {
    session.draw(findTile("1m")); // 5th copy → error
  } catch (e) {
    caught = true;
  }
  assert(caught, "overflow detected for 5th tile");
}

// Test 8: Wall estimate
console.log("\n[8] Wall estimate");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);
  const wall = session.getWallEstimate();
  // 144 total - 8 flowers - 39 (3 opponents × 13) - 13 (my hand) = 84
  assert(wall === 84, `wall estimate = ${wall}`);
}

// Test 9: countsToText
console.log("\n[9] countsToText");
{
  const counts = parseTiles("123m 456p EEN");
  const text = countsToText(counts);
  assert(text === "123m 456p EEN", `countsToText = "${text}"`);
}

// Test 10: Full game simulation (several rounds)
console.log("\n[10] Full game simulation");
{
  const session = GameSession.fromText("123m 456p 789s EENN", "", 0);

  // Round 1: draw 3m, engine recommends, discard something
  const r1 = session.draw(findTile("3m"));
  assert(r1.recommendations.length > 0, `round 1 has recommendations`);
  const bestDiscard = findTile(r1.recommendations[0].discard);
  session.discard(bestDiscard);
  session.recordOpponentDiscard(findTile("N"));

  // Round 2
  const r2 = session.draw(findTile("5p"));
  assert(r2.recommendations.length > 0, `round 2 has recommendations`);
  session.discard(findTile(r2.recommendations[0].discard));

  assert(session.turn === 2, `turn = ${session.turn}`);
  assert(session.getHandCount() === 13, `hand still 13 after 2 rounds`);
  console.log("  Full 2-round simulation completed successfully.");
}

console.log("\n=== All GameSession tests finished ===\n");
