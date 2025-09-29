プラグイン説明
概要：コンポーネントのインスタンスオブジェクトをgeojsonデータにする

使用条件：１つのフレームを選択している　かつ　選択中のフレーム内に子要素としてフレームが存在している　かつ　子要素のフレームの子要素にInstanceNodeオブジェクトが存在している
実行内容：上記の使用条件のInstanceNodeオブジェクトをgeojsonのfeatureデータに変更して、子要素のフレームごと（各階層ごと）に別々のgeojsonデータとしてまとめる。その後、ui部分でそれぞれのファイルを子要素のフレーム名-icon.geojsonという名前でダウンロードできる。

（補足）
１．本当は子要素のインスタンスだけでなくてもいいようにしたかったんだが、配置しているコンポーネントの構造がコンポーネント/コンポーネントみたいな感じになっていて１つのインスタンスから２つのfeatureが作成されることになるため、子要素のインスタンスという条件をつけている

変更するかもしれない部分
１．階層以外にもアイコンごとにファイルを分割するかも（扉、自販機＋トイレ）
２．ファイルの分割がある場合にはファイル名も変更する


Below are the steps to get your plugin running. You can also find instructions at:

  https://www.figma.com/plugin-docs/plugin-quickstart-guide/

This plugin template uses Typescript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

  https://nodejs.org/en/download/

Next, install TypeScript using the command:

  npm install -g typescript

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

  npm install --save-dev @figma/plugin-typings

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (code.ts) into JavaScript (code.js)
for the browser to run.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
    then select "npm: watch". You will have to do this again every time
    you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
