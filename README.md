# MathLang Web

MathLangの公開ティザー。個人R&Dが外部からどう見えるかを確かめるための、別リポジトリの静的サイトです。連立方程式・二群の判断・振動同定を紹介し、既存の限定受入と、新しい一巡の検証中部分を区別します。

## ビルド

Node.js 22以上を使います。パッケージの追加インストールは不要です。

```sh
node scripts/build.mjs
node scripts/check.mjs
python3 -m http.server 4173 --directory dist
```

生成先は `dist/`。GitHub Pagesのworkflowは、検査したこのディレクトリだけを公開します。独立した新repoの設定を使い、本体の設定・source・submoduleを参照しません。公式手順は [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) を参照。

## 状態と素材の更新

- `content/site.json` が紹介の状態・根拠の層・適用範囲・未達・資料照合日・更新日・将来のmedia参照の正本です。資料照合日を新しい製品受入日として扱いません。
- `src/` は新規本文・CSS・手書き説明SVG。図は製品UIや実行結果として扱いません。
- `public/materials/` は個別選定した新規公開素材7点。原byteのhashを照合して取り込みました。原QA・trace・本人会話・既存画像・製品sourceを含みません。
- `public/demos/d01/` は架空の生入力、`public/results/` は独立検算した説明例。開始入力へ実行済みPlanや学習済みモデルを混ぜません。
- `provenance/public-allowlist.json` は公開repoとdeployの明示ファイル一覧。新しい素材を入れる際は、公開可否・状態・説明を確認し、この一覧とhashを更新します。
- 生成する `dist/provenance/site.json` は採用元のsnapshot hashと公開素材hashを別欄に保持します。内部pathや原文は入れません。

新しい実演を掲載するときは、対応する版・元入力・Result・本人操作の受入と公開許可を確認してから、`media` と図・本文を更新します。D02は本人発言保存とpaired事実整合の修正後、主ペルソナの一巡が受入済みになるまで検証中です。

初版にフォーム、analytics、backend、外部フォント、第三者の画像や動画はありません。掲載例の独立検算は製品の計算性能・導入実績・価格の根拠に使いません。
