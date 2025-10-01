// --- code.ts ---

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: number[];
  };
  properties: {
    id: string;
    category: string;
  };
}

interface FloorData {
  floorId: string;
  geoJson: {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
  };
}

figma.showUI(__html__, { width: 280, height: 160 });

// ★★★ 追加: ネストされたノードのフロアフレーム内での絶対座標を計算する関数 ★★★
/**
 * 指定されたノードの、祖先であるフロアフレーム内での絶対座標を計算します。
 * @param node 座標を計算したいノード
 * @param floorFrame 基準となる親のフロアフレーム
 * @returns { x: number, y: number } | null フロアフレーム内に見つからない場合はnull
 */
function getAbsoluteCoordinates(node: SceneNode, floorFrame: FrameNode): { x: number, y: number } | null {
  let currentNode: SceneNode | null = node;
  let absoluteX = 0;
  let absoluteY = 0;

  // 親をたどっていき、フロアフレームに到達するまで座標を足し合わせる
  while (currentNode && currentNode.id !== floorFrame.id) {
    absoluteX += currentNode.x;
    absoluteY += currentNode.y;
    currentNode = currentNode.parent as SceneNode | null;
  }

  // もしループが最上位のページまで到達してしまったら（＝floorFrameの子孫ではなかった）
  if (currentNode === null) {
    return null;
  }

  return { x: absoluteX, y: absoluteY };
}

// --- メインの処理 ---
// ★ 変更点1: メインの処理を async 関数で囲む
async function main() {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1 || selection[0].type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: '最上位のフレームを1つだけ選択してください。' });
    return; // 関数を終了
  }
  
  const selectedFrame = selection[0];
  const floorFrames = selectedFrame.children.filter((child): child is FrameNode => child.type === 'FRAME');
  
  if (floorFrames.length === 0) {
    figma.ui.postMessage({type: "error", message: "選択したフレーム内に、各フロアを表す子フレームを配置してください"});
    return;
  }

  const frameHeightForYFlip = selectedFrame.height;

  // ★ 変更点2: floorFrames.forEach を Promise.all と map に置き換え
  const allFloorsDataPromises = floorFrames.map(async (floorFrame) => {
    const floorId = floorFrame.name;

    const topLevelInstances = floorFrame.findAllWithCriteria({
      types: ['INSTANCE']
    }).filter(node => node.parent?.type !== 'INSTANCE') as InstanceNode[];
    
    // 内側のPromise.allは変更なし (各フロア内のアイコン処理)
    const floorIconFeatures = await Promise.all(
      topLevelInstances.map(async (instance) => {
        // ★★★ 変更点: 新しい関数を使って絶対座標を取得 ★★★
        const coords = getAbsoluteCoordinates(instance, floorFrame);
        if (!coords) return null; // 座標が取得できなければスキップ

        // 中心座標を計算
        const centerX = coords.x + instance.width / 2;
        const centerY = coords.y + instance.height / 2;
        
        const component = await instance.getMainComponentAsync();
        const feature: GeoJsonFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [centerX, frameHeightForYFlip - centerY], 
          },
          properties: {
            id: `${instance.parent?.name}-${instance.name}`,
            category: component?.name ?? "",
          },
        };
        return feature;
      })
    );

    // nullになった要素を取り除く
    const validFeatures = floorIconFeatures.filter((f): f is GeoJsonFeature => f !== null);

    if (validFeatures.length > 0) {
      return {
        floorId: floorId,
        geoJson: {
          type: "FeatureCollection",
          features: validFeatures,
        }
      };
    }
    return null; // このフロアにアイコンがなければnullを返す
  });

  // ★ 変更点3: すべてのフロアの処理（Promise）が終わるのを待つ
  const results = await Promise.all(allFloorsDataPromises);

  // null（アイコンがなかったフロア）を取り除く
  const allFloorsData = results.filter((data): data is FloorData => data !== null);

  // ★ 変更点4: すべての非同期処理が終わった後で、安全にメッセージを送信
  if (allFloorsData.length > 0) {
    figma.ui.postMessage({
      type: 'export-floor-geojson-list',
      data: JSON.stringify(allFloorsData, null, 2),
    });
  } else {
    figma.ui.postMessage({ type: 'error', message: 'フレーム内にアイコンが見つかりませんでした。' });
  }

  // figma.close(); // 必要に応じてプラグインを閉じる
}

// ★ 変更点5: main関数を実行
main().catch(err => {
  console.error(err);
  // figma.closePlugin();
});