# The Estian Tattler

A gossip paper for one RimWorld colony, where every sentence has to prove itself.

The newsroom is a Sanity dataset built from a real save: 354 tales, 53 letters, 149 messages and 75 overheard conversations from the Tribe of Estian, 17 colonists, days 117 to 306. A Claude reporter writes the stories. A fact-checker that is plain code, not a model, reads every sentence against the records it cites. An editor approves or sends it back in Sanity Studio, and the press publishes it and rebuilds the front page.

Front page: https://booyaka101.github.io/estian-tattler/
Studio: https://estian-tattler.sanity.studio/

## The rule

Each sentence in a story is a claim or an aside, stored as Portable Text annotations.

- A claim cites one or more records. Every colonist it names must appear in one of those records. Every number in it, in digits or words, must appear in a cited record's text, be a cited record's colony day, or be the count of records cited.
- An aside is the paper's own voice. It may not name anyone and may not contain a number.
- The headline and dek are checked as claims against everything the body cites.

`studio/lib/factcheck.ts` is that rule. The same function runs in three places: as a tool the reporter calls before filing, as the workflow's fact-check stage, and as document validation in the Studio, so a human editing a story by hand can't publish a broken claim either.

What it can't check is anything about absence ("nobody noticed", "the only time"). That's the editor's job, and the first story sent back in this repo was sent back for exactly that.

## How a story moves

`newsroom/workflows/story-desk.ts` is a Sanity Workflows definition:

```
reporting -> fact-check -> editor -> printing -> printed
    ^            |           |  \
    +-- fails ---+           |   +-> spiked
    +--- send back (note) ---+
```

- **reporting** runs the `draft-story` effect: a Claude Agent SDK session with three MCP tools (`search_records`, `who_is`, `check_draft`) over the dataset. It writes the story as a draft document.
- **fact-check** runs `factcheck.ts` on the draft. Failures go back to reporting with the problems as a desk note. After three failed drafts the story is spiked.
- **editor** waits for a person: Send to press, Send back (with a note the reporter gets on the next draft), or Spike it. This happens in the Studio's Workflows tool or the story's Workflows tab.
- **printing** runs the `print` effect: numbers the edition, publishes the draft, and fires a `repository_dispatch` that rebuilds the front page.

Stories get pitched from the Studio with the "Pitch a story" action on any record, or from the Night Desk.

## The Night Desk

`nightdesk/` is an App SDK app that runs in the Sanity Dashboard. It's the editor's view of the whole paper rather than one story:

- A board with every run in its current stage, live from `useWorkflowInstances`.
- A run panel driven by `useWorkflowSession`. It shows the story with every claim marked with how many records back it, and the editor's buttons come from the session's evaluation, so Send back asks for its note because the action declares that param.
- A coverage meter: how many of each colonist's records the printed stories cite. Anyone at zero gets a Pitch button, which creates the story with their records as leads and starts a `story-desk` run for it.

Dashboard apps are only visible to members of the organization, so `docs/nightdesk.png` is what it looks like.

## What's here

- `ingest/parse_save.py` reads a `.rws` save (plain or gzipped) and writes `data/tattler.ndjson`: the colony, its pawns and every record. Tales carry no text of their own in the save, so it renders them from the tale def and the pawns involved.
- `studio/` is the schema (colony, pawn, record, story), the Receipts view that lays each sentence next to its records, the Pitch action, and the workflow plugin.
- `newsroom/` is the workflow definition and the effect handlers, plus `desk-runner.ts`, which claims and runs pending effects.
- `nightdesk/` is the App SDK dashboard app described above.
- `frontpage/` is a static Next.js site. Every underlined claim shows its records on hover or focus.

## Running it

Node 22. The dataset (`lcvgtfvq/production`) is public, so the front page builds with no token:

```sh
cd frontpage && npm install && npm run build
```

The newsroom needs a Sanity token with write access in `newsroom/.env` as `SANITY_TOKEN`, and a Claude login (Claude Code) or `ANTHROPIC_API_KEY` for the reporter. `GITHUB_TOKEN` is optional; without it the press publishes but doesn't rebuild the site.

```sh
cd newsroom && npm install
npm test
npx sanity-workflows start story-desk --field 'subject={"id":"dataset:lcvgtfvq:production:story-berry-rot","type":"story"}'
npm run desk
```

The Night Desk runs in your own organization's Dashboard. Set `organizationId` in `nightdesk/sanity.cli.ts` and drop the `deployment.appId`, then:

```sh
cd nightdesk && npm install && npm run dev
```

To rebuild the dataset from your own save:

```sh
python ingest/parse_save.py "path/to/Colony.rws" --colony "Your Colony"
```

[BUILDLOG.md](BUILDLOG.md) is how this got built, including what broke.
