# MathLang web

MathLangの公開用ティザー。数理計算・シミュレーション・AIアシストの現在の範囲を、実数値・能力一覧・構成で示します。

- 公開サイト: https://masayukisobe.github.io/mathlang-web/
- 素材: 新規本文・構成図、架空入力、選別した保存済みProcessor数値出力。
- 製品本体、原source・assets・会話・QA・traceは同梱していません。
- 計算実行UI、フォーム、収集、analytics、backendはありません。

Node.js 22以上で `npm run build` と `npm run check`。依存packageはありません。GitHub Actionsが明示allowlistの静的成果物だけをPagesへ公開します。

`provenance/public-allowlist.json` がsource・deploy・個別採用素材hashを制御します。公開manifestは採用根拠hashと公開ファイルhashを分離します。

`public/results/v1/` は2026-10-05の選別数値資料8点。波形はこのCSVの4系列を描いたもので製品UI画像ではありません。受入は固定SI・既知質量の1自由度、有界同定、指定出力時刻の有限候補比較です。新入力からの本人一巡は採取時点で未受入、通常AI会話は未接続、公共KBaseは構想です。

`public/materials/` は初版の説明資料7点を元hashで保持した履歴です。初版の独立検算用値と、新しい実数値資料は別です。`content/capabilities.json` は共通22 operationの明示field投影で、全UI・一般Agent実行の完成を意味しません。

実行UI・収録済み実演は個別の公開許可と本人一巡の確認後に別版として差し替えます。

波形の任意再生成は `scripts/generate-plots.py`（Matplotlib 3.10.6）。通常buildは保存済みSVGをコピーし、Pythonやsolverは実行しません。
