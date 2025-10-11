// --- code.ts ---

interface IconGeoJsonFeature {
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

interface IconFloorData {
  floorId: string;
  geoJson: {
    type: "FeatureCollection";
    features: IconGeoJsonFeature[];
  };
}

//施設ポリゴンの定義
interface RoomFloorData {
  floorId: string;
  geoJson: GeoJsonFeatureCollection;
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

type GeoJsonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
} | {
  type: "Point";
  coordinates: number[];
};

interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: {
    [key: string]: any;
  };
}

//アイコンデータと施設データをまとめたデータ定義
interface IconFloorDataWithRoomPolygonData {
  icon: IconFloorData;
  room: RoomFloorData;
}

// ★★★ 追加: 1つの閉路を前提とした、よりシンプルなパス追跡関数 ★★★
/**
 * 1つの閉じたループのみで構成されていることを前提に、セグメントから頂点の描画順を再構築します。
 * @param segments ベクター全体のセグメントリスト
 * @returns 描画順に並んだ頂点のインデックスの配列
 */
function traceSingleLoop(segments: readonly VectorSegment[]): number[] {
  if (!segments || segments.length === 0) {
    return [];
  }

  // 作業用にセグメントのリストをコピー
  const remainingSegments = [...segments];
  const firstSegment = remainingSegments.shift()!;
  
  // 順序付けされた頂点インデックスのリストを初期化
  const orderedIndices: number[] = [firstSegment.start, firstSegment.end];
  let currentVertexIndex = firstSegment.end;

  // すべてのセグメントを使い切るまでループ
  while (remainingSegments.length > 0) {
    let foundNext = false;
    for (let i = 0; i < remainingSegments.length; i++) {
      const nextSegment = remainingSegments[i];
      let nextVertexIndex: number | null = null;
      
      if (nextSegment.start === currentVertexIndex) {
        nextVertexIndex = nextSegment.end;
      } else if (nextSegment.end === currentVertexIndex) {
        nextVertexIndex = nextSegment.start;
      }

      if (nextVertexIndex !== null) {
        orderedIndices.push(nextVertexIndex);
        currentVertexIndex = nextVertexIndex;
        remainingSegments.splice(i, 1); // 使用済みのセグメントを削除
        foundNext = true;
        break; // 内側のforループを抜ける
      }
    }
    if (!foundNext) {
      // 次に繋がるセグメントが見つからなかった場合（＝閉じていないパスなど）
      // ループを終了して、それまでの結果を返す
      break; 
    }
  }

  // 始点と終点が同じになっているはずなので、最後の要素を削除して重複を防ぐ
  if (orderedIndices[0] === orderedIndices[orderedIndices.length - 1]) {
    orderedIndices.pop();
  }

  return orderedIndices;
}

const generate_feature_list_from_one_frame = (one_frame: FrameNode) => {
  const feature_list: GeoJsonFeature[] = [];

  const frame_height = one_frame.height;

  // const vectorNodes = one_frame.findAll(node => node.type === 'VECTOR') as VectorNode[];
  const targetNodes = one_frame.children;
  if (targetNodes.length === 0) {
    figma.ui.postMessage({ type: 'error', message: '選択されたフレーム内にベクターオブジェクトが見つかりませんでした。' });
    
  } else {
    targetNodes.forEach(targetNode => {
      const facilityId = targetNode.name;
      // const nameParts = targetNode.name.split(',').map(part => part.trim());
      // if (nameParts.length == 0) { return; }

      // const [facilityName, category] = nameParts;
      // const floor = parseInt(floorStr, 10);
      // if ((!floor)) { return; }

      if (targetNode.type === "VECTOR") {
        // ★変更点: 新しいtraceSingleLoop関数を呼び出す
        const orderedVertexIndices = traceSingleLoop(targetNode.vectorNetwork.segments);
        if (orderedVertexIndices.length < 3) return; // 3頂点未満はポリゴンにできない
        // 取得したインデックスの順序で、頂点オブジェクトの配列を再構築
        const orderedVertices = orderedVertexIndices.map(index => targetNode.vectorNetwork.vertices[index]);
      
        // ★変更点3: 各頂点の座標を基準オブジェクトからの相対座標に変換
        const coordinates = [orderedVertices.map(v => {
          // 頂点の絶対座標 = ベクター自体の座標 + ベクター内の頂点座標
          const absoluteX = targetNode.x + v.x;
          const absoluteY = targetNode.y + v.y;
          // 絶対座標から基準オブジェクトの座標を引く
          return [ absoluteX, frame_height - absoluteY];
        })];

        if (coordinates.length > 0) {
          coordinates[0].push(coordinates[0][0]);
        }

        //内部に空洞があるような図形はcoordinatesにループの座標を追加する
        if (targetNode.vectorNetwork.regions !== undefined && targetNode.vectorNetwork.regions.length !== 0) {
          console.log(targetNode.parent?.name, targetNode.name);
          console.log(targetNode.vectorNetwork.regions[0].loops);
          targetNode.vectorNetwork.regions[0].loops.slice(1).forEach((loop) => {
            console.log(`loopだよ: ${loop}`);
            const now_segments: VectorSegment[] = loop.map(segment_index => targetNode.vectorNetwork.segments[segment_index]);
            const orderedVertexIndices = traceSingleLoop(now_segments);
            if (orderedVertexIndices.length < 3) return; // 3頂点未満はポリゴンにできない
            // 取得したインデックスの順序で、頂点オブジェクトの配列を再構築
            const orderedVertices = orderedVertexIndices.map(index => targetNode.vectorNetwork.vertices[index]);
            const orderedVerticesinGeojsonType = orderedVertices.map(v => {
              // 頂点の絶対座標 = ベクター自体の座標 + ベクター内の頂点座標
              const absoluteX = targetNode.x + v.x;
              const absoluteY = targetNode.y + v.y;
              // 絶対座標から基準オブジェクトの座標を引く
              return [ absoluteX, frame_height - absoluteY];
            });
            if (orderedVerticesinGeojsonType.length > 0) {
              orderedVerticesinGeojsonType.push(orderedVerticesinGeojsonType[0]);
            }
            coordinates.push(orderedVerticesinGeojsonType);
          });
        }

        const feature: GeoJsonFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: coordinates,
          },
          properties: {
            id: facilityId
          },
        };
        feature_list.push(feature);
      } else if (targetNode.type === "FRAME") {
        const { x, y, width, height } = targetNode;
        const coordinates = [[x, y],[x+width, y],[x+width, y+height],[x, y+height],[x,y]].map((v) => {
          return [v[0], frame_height-v[1]];
        });
        const feature: GeoJsonFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coordinates],
          },
          properties: {
            id: facilityId
          },
        };
        feature_list.push(feature);
      } else if (targetNode.type === "ELLIPSE") {
        // 円の中心座標を計算
        const centerX = targetNode.x + targetNode.width / 2;
        const centerY = targetNode.y + targetNode.height / 2;
        // 円の半径を計算 (width / 2 を半径とします)
        const radius = targetNode.width / 2;

        const feature: GeoJsonFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [centerX, frame_height - centerY],
          },
          properties: {
            id: facilityId,
            radius: radius, // 半径をプロパティに追加
          },
        };
        feature_list.push(feature);
      }

      
    });
  }
  return feature_list;
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
        const feature: IconGeoJsonFeature = {
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
    const validFeatures = floorIconFeatures.filter((f): f is IconGeoJsonFeature => f !== null);

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
  const allFloorsData = results.filter((data): data is IconFloorData => data !== null);

  //施設ポリゴンデータの作成
  // ★★★ 変更点: フロアごとのデータを格納する配列を作成 ★★★
  const allFloorsRoomData: RoomFloorData[] = [];

  floorFrames.forEach(one_frame => {
    // 各フロアのフィーチャーリストを生成
    const features = generate_feature_list_from_one_frame(one_frame);

    // フロアIDとGeoJSONデータのペアを配列に追加
    allFloorsRoomData.push({ 
      floorId: one_frame.name,
      geoJson: {
        type: "FeatureCollection",
        features: features
      }
    });
  });

  //アイコンデータと施設データをまとめたデータを作成
  const toUiData: IconFloorDataWithRoomPolygonData[] = [];
  floorFrames.forEach((one_frame) => {
    const floorId = one_frame.name;
    const _icon = allFloorsData.find((data) => {
      return data.floorId === floorId;
    });
    const _room = allFloorsRoomData.find((data) => {
      return data.floorId === floorId;
    });
    if (_icon == undefined || _room == undefined) {
      console.log("アイコンデータと施設データの統合に失敗しました");
      return null;
    }
    toUiData.push({
      icon: _icon,
      room: _room
    });
  });

  // ★ 変更点4: すべての非同期処理が終わった後で、安全にメッセージを送信
  if (toUiData.length > 0) {
    figma.ui.postMessage({
      type: 'export-floor-geojson-list',
      data: JSON.stringify(toUiData, null, 2),
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