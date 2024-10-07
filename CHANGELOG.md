# Change Log

## v0.5.0
- Highlight results in the queried file
- Update find files to match vscode search look and feel

## v0.4.2 (2024-04-27)
- Fixed cancel for long running find mode
- Added exclude files/folders term in find mode

## v0.4.1 (2024-04-20)
- Improved Find tab/mode user experience
- Fixed "remove" find file line item bug
- Fixed directory lookup

## v0.4.0 (2024-04-17)
- Navigate to will now select the clicked symbol and its value in editor
- Find JSON files in directories feature (beta)
    - new *Find* tab/mode. *Query* tab/mode is used for existing functionalities
    - return only JSON files that yield results from given path expression
    - case insensitive file matching

## v0.3.1 (2024-03-02)
- Fixed navigation to line to target the correct queried file and tab group
    - if file is closed, navigate will open the queried file in the active tab group

## v0.3.0 (2023-12-21)
- Bumped [JSXPath](https://github.com/Quang-Nhan/JSXPath) to v1.1.5
- Added the ability to star a path history (max 5 items)
- Fixed error where nothing is returned when running in a new workspace (or fresh installs)
- Fixed running path with full axis name expression (contains '::')

## v0.2.0 (2023-09-12)
- Changed path from input to textarea field
- Added path history (max 20 items)

## v0.1.1 (2023-06-17)
- Bumped [JSXPath](https://github.com/Quang-Nhan/JSXPath) to v1.1.4
    - fixes root descendants xpath used as argument
    - fixes boolean filter expressions

## v0.1.0 (2023-06-23)
- Navigate to the line in queried file
- Fixed unexpected label for array items

## v0.0.2 (2023-05-27)
- Bumped [JSXPath](https://github.com/Quang-Nhan/JSXPath) to v1.1.2
- Fixed getting parent node
- Fixed error "element with id X is already registered" 

## v0.0.1 (2023-05-19) - initial release
- Uses JSXPath v1.1.1
- Query json document on an opened JSON file
- Review the query result in a new JSON file
- Perfom built in [JSXPath](https://github.com/Quang-Nhan/JSXPath) functions