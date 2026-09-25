# Build log

This was built by Claude Code (Claude Opus 5.5) in one session on 2026-09-25. The owner of this repo handed over the whole challenge with one instruction, to go all out. They didn't pick the idea or write any of it. So "I" below is Claude Code. The prompts that mattered were the ones I wrote for the reporter, and they're quoted here.

## Picking the idea

My first idea overlapped with a project the owner had already shut down, so I dropped it.

The owner plays heavily modded RimWorld, and a save file is a strange thing to build on. It keeps tales ("X was wounded by Y", "X married Y"), the letters the game shows you, a message log, and the last few dozen pawn-to-pawn conversations. The Tribe of Estian save had 354 tales and a couple of hundred messages. That's a colony's gossip with timestamps. A tabloid is the obvious format for gossip, and the thing that makes a tabloid interesting to build is making it unable to lie.

## Getting the save into Sanity

`ingest/parse_save.py` walks the save XML. What went wrong:

- The def-label lookup scanned every mod folder for the human-readable names of things and took about three and a half minutes. It now caches the labels in `ingest/def_labels.json` and only rescans with `--scan-defs`.
- Play-log conversations came out empty. The pawn lookup only walked `<li>` elements, but pawns on the map are `<thing>` elements. Switched to `root.iter()`.
- Text still had the game's colour and faction tags in it, like `(*Name)...(/Name)`. Generalised the regex that strips them.
- Pawn names came from the first snapshot of a pawn in the save, not the latest, so a pawn could show a name they no longer went by. It now takes the latest.
- Sanity treats document ids with a dot in them as non-public, and the front page reads the public API with no token. Ids are hyphenated: `record-tale-547`, `pawn-Human147640`.

The save forgets tales older than roughly day 117, so the colony document records `firstRecordDay` and the front page says so. Nothing before it can be printed.

## The schema

A story's body is Portable Text with two annotations, `claim` (references to records, at least one) and `aside` (the paper's voice). That's what makes the checker possible. The claim isn't free text next to a list of sources, it's the exact span of words tied to the exact records.

I wrote the checker (`studio/lib/factcheck.ts`) before the reporter, with tests, so the reporter would be written against a rule rather than the other way round. Its first real bug turned up on the first real story: Snake and Grasshopper share the surname Rato, so "Snake Rato" counted as naming Grasshopper too, and a correct claim failed. Names now map to every pawn that answers to them, and a claim passes if any of those pawns is in its records. There's a test for it.

## The reporter

The reporter is a Claude Agent SDK session with no built-in tools, only three MCP tools over the dataset: `search_records`, `who_is` and `check_draft`, which runs the same checker. It returns structured output (headline, dek, paragraphs of sentences with record ids), which gets turned into Portable Text. The system prompt, in full:

> You are a reporter for the Estian Tattler, the gossip paper of a RimWorld colony called the Tribe of Estian. Everything you know comes from the colony's records: tales, letters, messages and overheard conversations pulled from the save file. The fact-checker is a program, not a person, and it checks every sentence: Each sentence is either a claim or an aside. A claim cites the ids of the records that prove it. Only say what those records say. Every colonist a claim names must appear in one of its cited records. Every number in a claim, in digits or words, must appear in a cited record's text, be a cited record's colony day, or be the count of records cited. An aside is the paper's own voice: a quip, a question, a raised eyebrow. Asides may not name anyone and may not contain numbers. The headline and dek follow the claim rules, checked against every record the body cites. Write like a small-town tabloid that loves these people: sharp, warm, a little nosy. Dates are colony days ('on Day 142'). Short paragraphs, 150 to 350 words in all. Don't invent motives, feelings or events. If the records don't say why something happened, wonder about it in an aside. Only use he or she for someone who_is gives a gender for. Otherwise use their name. Use check_draft before you file, and fix everything it reports.

"Be the count of records cited" is there so the reporter can say "five times" by citing five records. It uses that a lot, and it's the reason the berry story can say "39 times" and be checked.

First drafts, all through the real workflow:

| story | tool calls | time | fact-check |
|---|---|---|---|
| Snake and Grasshopper | 7 | 74s | passed, 8 claims |
| The berry pile | 10 | 86s | passed, 10 claims |
| Who hits whom | 8 | 73s | passed, 12 claims |
| The restaurant | 6 | 60s | passed, 8 claims |

None failed the checker, because the reporter runs `check_draft` and fixes things before filing. I still read each one against its records by hand, and checked the counts myself: the 39 berry reports, the five on Day 289, the five wounds on Day 117. They were right. I also checked the pronouns, which the checker doesn't look at.

What the checker can't see is a claim about absence. The first berry draft said "the only food drama on file is Grasshopper's binge" and "the records show nobody remarking on it". Every cited record backed the words around those phrases, and both were unprovable. So the editor stage sent it back with the note "You can prove what a record says, not that nothing else exists." The second draft turned both into questions and passed. That's the case for keeping a person at the editor stage, and it's written into the README.

## Workflows

`story-desk` has six stages, and the loop is in the transitions. A failed fact-check goes back to reporting while `drafts < 3` and to spiked after that. Send back resets the count and hands the reporter the editor's note as `deskNote`. The effects (`draft-story`, `fact-check`, `print`) run in `desk-runner.ts`, which polls for instances with unclaimed effects and drains them with a 20-minute lease, since a reporter session takes a minute or two.

The Studio side is `@sanity/workflow-studio-plugin`. It gives a Workflows tool with every open run and its stage graph, where the editor's Send to press / Send back / Spike it buttons live. The first approval through the Studio buttons worked on the first try.

## Things that broke on the Studio side

- `tsc` wanted explicit `.js` extensions on relative imports under `NodeNext`. Moved the newsroom to `module: ESNext` with `Bundler` resolution, since `tsx` runs it anyway.
- `@sanity/ui` v4 moved `Tooltip` to `@sanity/ui/tooltip` and renamed `Stack`'s `space` prop to `gap`.
- `@sanity/icons` v5 ships one module per icon. `import {ComposeIcon} from '@sanity/icons'` typechecked fine and then failed the Studio build with `MISSING_EXPORT`. It's `@sanity/icons/Compose` now.
- The workflow plugin needed an npm override pinning `@sanity/mutate` to 0.18.2 under `@sanity/sdk` to install cleanly.
- The Receipts view crashed the structure tool when opened from a link. The view had no `.id()`, so the router had nothing to resolve the URL to. Local `sanity dev` wanted a login, so I debugged it by attaching to the deployed Studio's iframe over the Chrome DevTools protocol and reading the exception there.
- Three times, writing a file through a shell heredoc mangled a backslash: in a regex, in a `'\n'` join, and in a Python string. Those files get written with an editor tool now.

## The front page

Static Next.js on GitHub Pages. It only fetches published stories with a `printedAt`, so a draft can't leak onto it. Every claim is underlined, and hovering or focusing it shows the records it cites, with the day and hour. The press fires a `repository_dispatch` and the Action rebuilds the site, so printing a story in the Studio puts it on the front page a couple of minutes later.

## The Night Desk

The Studio's Workflows tool shows one run at a time, and the paper's real question is who it hasn't written about. So `nightdesk/` is an App SDK app in the Dashboard: `useWorkflowInstances` for a board of every run by stage, `useWorkflowSession` for the open run, `useQuery` for the story and the coverage counts, and `useCreateDocument` plus `engine.startInstance` for Pitch. The buttons in the run panel aren't hardcoded. They're the actions the session's evaluation says are available, and Send back stays disabled until its note is filled in, because the action declares a required `note` param. The engine records each commit's execution context, and runs driven from the app show up in the instance history as `sdk` / `browser`.

What went wrong:

- Pitch created the story, awaited `startInstance`, then opened the run. Nothing appeared to happen. The run was on the board within seconds, but the promise settled much later, since every engine commit from the browser does a tick that takes about three seconds. Pitch now mints the instance id with `instanceDocId`, opens the panel on it straight away, and only uses the promise to report an error.
- The first pitched story got the id `story-human99323-<timestamp>`. I aborted that run and ids are slugged from the name now, so it's `story-flubber-flubber`.
- Once Flubber was pitched, the coverage list flagged his grave visitors "on the desk" too, though they'd been in print for editions. Grave-visit records name the visitor as well as the dead, so a pitch for one colonist puts records about the others into its leads. The flag now only shows for someone the paper hasn't cited at all.
- After I spiked a story, everyone in its leads stayed "on the desk" with no Pitch button. "On the desk" meant any unprinted story, and a spiked story is never printed. It now means a story with a run still in flight.
- The Dashboard puts the app in an iframe on a different host from the page, so the CDP screenshots attach to the iframe target by host.

Two stories went through the whole loop from the app.

Flubber Flubber had ten records, all grave visits, and the paper had never printed him. Pitch, reporter, fact-check passed with 8 claims. Reading it, three sentences said more than their receipts: "more than anyone else on record", "the last one in the files" and "the colony's own records say little more". Each named the right people and cited real visits, so the checker couldn't object, but they were claims about records the story didn't cite. I sent it back from the Night Desk with that note. The rewrite cited all ten visits, so "more than any other visitor on record" is now something a reader can count, and it passed with 7 claims. I sent it to press from the app and it's edition 5. Flubber's pawn is `Male` in the save, so "his grave" is right.

Marcellina Triarius, a visitor with 29 records, went the other way. The draft passed with 7 claims, and every one checked out against its records. I spiked it anyway. All 29 records are chats, so two days of small talk was the whole story. It called her "she", but visitors come through the ingest with no gender, so that was a guess from the name. And it ended with "the last word so far went to Aquila Summanus" on a record where Marcellina is the one talking. That's the third thing the checker can't see after absence and comparison: a claim that cites the right record and reads it backwards.

The pronoun one is fixable upstream. `who_is` now says "gender not on file" instead of leaving it blank, and the prompt got its last rule before check_draft: only use he or she for someone `who_is` gives a gender for.
