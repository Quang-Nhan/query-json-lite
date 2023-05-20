# Query JSON - lite

Interactively query a JSON file using XPath like notation


---
## Features
### Query JSON object
- "/a/b" : *get the value of "b" by traversing from root to "a" to "b"*
- "//h" : *from root grab any decendants' value with key "h"*

![Query Object JSON](resources/QueryObject.gif)

---
### Query JSON array
- /incomes/\* : *grab all objects in incomes array*
- /incomes/\*/type : *return all income types*

![Query Array JSON](resources/QueryArray.gif)

---
### Filtering
- /incomes/\*[frequency = "monthly"]: *return incomes that has a frequency value of "monthly"*

![Filter Incomes](resources/QueryFilter1.gif)
- /expenses/\*[value > -400 and value < -200 ]: *return expenses that where it's value is between -400 and -200*

![Filter Expenses](resources/QueryFilter2.gif)

---
### Built in Functions

Query JSON uses JSXPath behind the scene to perform path querying. Check out the available built-in [functions here](https://github.com/Quang-Nhan/JSXPath/blob/master/README.md#built-in-functions).

- count( /expenses/*[ type = "transport"] ): **Count how many transport expenses.**

![Transport Expenses count](resources/TransportExpensesCount.png)

- **ceiling**( /incomes/\*[ **last**() ]/value ): *combines both ceiling and last functions to return the rounded up integer value of the last positioned income*

![Ceiling function](resources/Ceiling.png)

- **sum**( /incomes/\*[frequency="monthly"]/value ) - **abs**( **sum**( /expenses/\*[frequency="monthly"]/value ) ): *combines both sum and abs functions to get the net income that have frequency of "monthly"*

![Sum and Abs functions](resources/SumAbsFunctions.png)

---
### Review the result in a file
Once the result is returned in the Query Result view, it can also be viewed in a in the editor by clicking on the Output button displayed next to the Query Result title.

![](resources/PreviewResult.gif)

<!-- ## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something. -->

<!-- ## Known Issues -->

<!-- Calling out known issues can help limit users opening duplicate issues against your extension. -->





