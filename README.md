# Introduction 
TODO: Give a short introduction of your project. Let this section explain the objectives or the motivation behind this project. 

# Getting Started
TODO: Guide users through getting your code up and running on their own system. In this section you can talk about:
1.	Installation process
2.	Software dependencies
3.	Latest releases
4.	API references

# Build and Test
TODO: Describe and show how to build your code and run the tests. 

# Contribute
TODO: Explain how other users and developers can contribute to make your code better. 




Some things to look into:
- JSS:  https://cssinjs.org/
- Office UI Fabric React: https://developer.microsoft.com/en-us/fluentui#/controls/web, https://docs.microsoft.com/en-us/javascript/api/office-ui-fabric-react?view=office-ui-fabric-react-latest


TODO items
- Work on question viewer. Unlike previous approaches, show the tossup and bonus for this cycle
  - Focus on getting questions to show up first
  - Then, focus on adding the click events. Original approach could be fine (player names next to buttons of Yes/No/Clear)
    - May need to think on how to make it keyboard-friendly. Use the arrow keys to scroll through different words?
    - Can avoid scoring at first, then do it later
    - Tossups should show indicator (underline, coloration) for where buzzes occurred
    - Bonuses should have checkboxes next to each part
    - Show tossup and bonus for each cycle, but if no one got it correct, keep the bonus grayed out.
      - We may need a way to efficiently compute the bonus at each cycle (to save on calculating it each render)
    - Lower priority, but we should let users choose the font face and the font size
- Work on initializing the cycles; jumping to specific ones will depend on it. Cycle chooser should use that instead of the packet eventually
- Create FormatRules? Something to tell us how many tossups per game, and how to handle tie-breakers. Eventaully replace this with the qb schema
- Show the score, and calculate and keep track of scoring
- Add the event log view, which shows the question number and relevant events 
  - One potential trick: if we make "halftime" the first event, then cycle index and question index will match up
  - This view should have numbers on the left for each cycle index, and on the right it should show things about buzzes
    and bonus conversion. On the right should be the score at that point.
  - Clicking on an event (number?)
  - Ideally this would be collapsable/expandable
- Add the player scoring summary view
  - Divided in two; team name on top, players with their Powers/TUs/Negs/Total in the same line
- Figure out how to get bolding/underline/italics to fit in well with the text. May want separate tags if underlines are
  broken up, or may want to avoid creating a dom element for each word in bonuses and answers.

- After the views are done, some of the more nitty-gritty stuff:
  - Accepting packets, first as JSON.
  - Sending an output of the state.
  - Integrate with qbschema so the output is consumable
  - Look into creating an SQBS round with it?
  - Look into using a server to get this information (packet, teams, etc.)

- Could do this
  - Have Google Sheet/other document with list of team names and players. Reader uploads the packet (jsonfied), picks the
    teams with a dropdown, maybe sets the round. The page could generate a new Google Doc in the folder that would be the
    scoresheet. Scoring actions would make requests to Google Doc to update the specific cells.
  - Would need to investigate the feasibility of having a purely client-side Google OAuth application. Danger is usually
    around secrets. Otherwise, we'd want to create a server application, and have the server update the Google Sheet.
    Might introduce some delay, but it means we don't need to create those components (can just use an iframe). If we have
    a server application, we can also use parsers to conert docx/html files to JSON, and coordinate the tournament. That's
    much more planning, though.
     - Would have to try to match https://drive.google.com/drive/folders/1E9uv0wWiF1xleINi_0P_w9Rr7yodAlLL, or something
       that could be treated like that. Would almost need to have some portal to set it up beforehand