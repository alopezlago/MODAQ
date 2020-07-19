# Introduction

This is a tool for reading, scorekeeping, and tracking buzz poins for quiz bowl matches.

# Getting Started

TODO: Guide users through getting your code up and running on their own system. In this section you can talk about:

1. Installation process
2. Software dependencies
3. Latest releases
4. API references

To setup the project, run

`npm init`

Then

`npm build`

Then open index.html.

VS Code is recommended as an IDE, although you can use whatever editor you like. If you install VS Code, be sure to install the Prettier VS Code extension.

# Build and Test

To build, run

`npm build`

To run the tests, run

`npm test`

# Contribute

TODO: Explain how other users and developers can contribute to make your code better.

# Miscellaneous tracking

Some things to look into:

-   JSS: https://cssinjs.org/
-   Office UI Fabric React: https://developer.microsoft.com/en-us/fluentui#/controls/web, https://docs.microsoft.com/en-us/javascript/api/office-ui-fabric-react?view=office-ui-fabric-react-latest

TODO items

Next items to work on (figure out an order)

-   May also want a button to export to JSON, or get access to buzz data in some fashion
-   Investigating WebSockets, to see if integration with the Discord tournament assistant would work, and supply the
    teams/players/readers. The bot could also track scores in real-time and show who's on top, and maybe allow for
    rebrackets.
-   Move different CycleItems to their own components, so we can properly memoize callbacks
-   Look into integrating with something like Google Sheets, so we can save a spreadsheet while everything is being done.
    -   This should maybe be an explicit action to enable. It could also be a way to add a new game, e.g. "New game (local)"
        and "New game (spreadsheet)"
    -   Could also export to a Google Sheet. Might be best to make this an option on new game, so it can always be
        persisted there in case we get into a bad state.
-   Add format rules so we can support powers (and see how the parser generates them)
-   Should look into the perf of the buzz menu; seems to be a noticeable delay the first time we click on a question.
    -   Using the profiler, doesn't seem directly related to the code
    -   We're using ES that supports Set<>, so use it more often (maybe for active players?). Would be nice for events,
        except serialization becomes more annoying.

*   Work on question viewer. Unlike previous approaches, show the tossup and bonus for this cycle
    -   Lower priority, but consider making the font and font size adjustable
*   Create FormatRules? Something to tell us how many tossups per game, and how to handle tie-breakers. Eventaully replace this with the qb schema
    -   This might mean adding support for more complex events:
        -   Substitutions (alternative is always showing every player)
        -   Throw out tossups or bonuses
            -   Need to also determine which question is read, which could belong to the format rules
        -   These need to be discoverable for them to be effective, this will be very frustrating for readers otherwise
            -   Also need to consider if there should just be a "packet" view, that lets them see all tossups and bonuses
*   Show the score in a nicer component
*   Improve the event viewer
    -   One potential trick: if we make "halftime" the first event, then cycle index and question index will match up
    -   This view should have numbers on the left for each cycle index, and on the right it should show things about buzzes
        and bonus conversion. On the right should be the score at that point.
    -   Should look into showing the score (either in the scoreboard, or on a tooltip, or at the bottom)
*   Add the player scoring summary view
    -   Divided in two; team name on top, players with their Powers/TUs/Negs/Total in the same line
*   This may be out-of-scope, but a page to take in packets and a schedule, which then produces files for all of the readers.
    They can then upload it to the page to run the tournament.
*   Make the tossups/bonuses collapsible so they can take up less space, and make the event viewer collapsible
*   Move to mergeStyleSheets and remove (direct) dependency on react-jss
*   Substitution improvements:

    -   Allow substitutions, and only show current players in the dropdown
        -   See if we can mitigate the issue where, once a player is added, you can sub them in before they were added.
            -   Another rough bit of UI is that, if someone leaves and a sub fills in their place, you have to do a sub event.
                If you make them leave, you can't bring the sub back on, since they already "exist"

*   After the views are done, some of the more nitty-gritty stuff:

    -   Sending an output of the state.
    -   Integrate with qbschema so the output is consumable
    -   Look into creating an SQBS or Yellow Fruit round with it?
    -   Look into using a server to get this information (packet, teams, etc.)
    -   Consider adding dark-theme support: https://medium.com/better-programming/how-to-build-dark-and-light-theme-with-web-components-a63ca1570bfe
    -   Add escape hatches if things get stuck (adding teams, reading the rest of the packet, etc.)
    -   Look into space optimizations to reduce the size of the bundle (e.g. code-splitting). When this was written the
        minimized bundle was 793 KB, which is above Webpack's recommended size of 244 KB.

*   Could do this

    -   Have Google Sheet/other document with list of team names and players. Reader uploads the packet (jsonfied), picks the
        teams with a dropdown, maybe sets the round. The page could generate a new Google Doc in the folder that would be the
        scoresheet. Scoring actions would make requests to Google Doc to update the specific cells.
    -   Would need to investigate the feasibility of having a purely client-side Google OAuth application. Danger is usually
        around secrets. Otherwise, we'd want to create a server application, and have the server update the Google Sheet.
        Might introduce some delay, but it means we don't need to create those components (can just use an iframe). If we have
        a server application, we can also use parsers to conert docx/html files to JSON, and coordinate the tournament. That's
        much more planning, though.
        -   Would have to try to match https://drive.google.com/drive/folders/1E9uv0wWiF1xleINi_0P_w9Rr7yodAlLL, or something
            that could be treated like that. Would almost need to have some portal to set it up beforehand
        -   Could even have it be reactive and listen to workbook changes

*   Can get json-ified packets from Jerry's parser

    -   usage python packet_parser -
    -   Files from D:\qbsets\Fall2015
        "C:\Program Files (x86)\Microsoft Visual Studio\Shared\Python37_64\python.exe" packet_parser.py -f "D:\qbsets\Fall2015\Berkeley B + MIT A.docx" -o process -op D:\qbsets\BerkB.json

*   Integrations to look into:
    -   Use Google Sheets to recreate Ophirstats-like spreadsheets, which could then use https://github.com/hftf/oligodendrocytes for analysis
    -   Import tournaments from Yellowfruit, and export Yellowfruit tournaments so they can be merged.
    -   Export it into some format that https://github.com/hftf/belgrade can understand, so we can get visualizations quickly
    -   Wild idea would be to tie it in with the Discord Tournament Assistant; it could get the schedule from there, and
        let the reader choose who they are. This means a socket to the bot would have to be created, and could lead to DoS
        issues. But then the bot could do things like score tracking, live updates, etc.
        -   Could use something like SignalR (WebSocket wrapper) to connect them. This would mean the bot would have to be
            more like a classical ASP.Net Core service, but it has some of that setup already
        -   Bot could communicate schedule, teams, players, and readers. Reader can pick who they are, and the round.
        -   There would need to be a way to tie the tournament to the page. Bot could DM the TD a GUID or 4-word passphrase
            to send to readers, and readers could choose who they are.
            -   One possible concern would be players changing their names, which could mess up stats.
            -   On a buzz in the reader's room (for that round), it should highlight the word and pop up a menu
                (correct/wrong), so then the reader can pick it.

Note: if we ever test react components in the future, we'll need something like this for the tests:
"test": "mocha --recursive tests/\*_/_.ts --exit --check-leaks --require ts-node/register --require global-jsdom/lib/register --require raf/polyfill -r tsconfig-paths/register"
