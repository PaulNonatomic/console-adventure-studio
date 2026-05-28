/**
 * Right-panel content — either a scene editor (when a scene is
 * selected in the graph) or the adventure-level editor (when
 * nothing's selected). The header strip with the scene/adventure
 * label is shared.
 *
 * The outer aside / width / border are provided by RightPanel,
 * which hosts both this inspector and the playtest terminal in
 * a tab system. ScenePanel is content-only.
 */
import { PHOSPHOR, DIM, PANEL_BORDER } from '../lib/theme';
import { SceneEditor } from './SceneEditor';
import { AdventureEditor } from './AdventureEditor';
import type { AdventureJson } from 'console-adventure';

interface Props {
	json: AdventureJson;
	maxScore: number;
	selectedSceneId: string | null;
	onJsonChange: (next: AdventureJson, opts?: { remount?: boolean }) => void;
	onSelectScene: (id: string | null) => void;
}

export function ScenePanel({
	json,
	maxScore,
	selectedSceneId,
	onJsonChange,
	onSelectScene
}: Props) {
	const scene = selectedSceneId ? json.scenes[selectedSceneId] : null;

	return (
		<>
			<div
				style={{
					padding: '14px 18px',
					borderBottom: `1px solid ${PANEL_BORDER}`,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'baseline'
				}}
			>
				<span
					style={{
						color: PHOSPHOR,
						fontWeight: 700,
						fontSize: 13,
						letterSpacing: '0.05em'
					}}
				>
					{selectedSceneId ? '~/scene' : '~/adventure'}
				</span>
				<span style={{ color: DIM, fontSize: 10 }}>
					{scene
						? `${scene.choices.length} choice${scene.choices.length === 1 ? '' : 's'}`
						: `${Object.keys(json.scenes).length} scenes`}
				</span>
			</div>

			<div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
				{selectedSceneId && scene ? (
					<SceneEditor
						json={json}
						sceneId={selectedSceneId}
						onJsonChange={onJsonChange}
						onSelectScene={onSelectScene}
					/>
				) : (
					<AdventureEditor
						json={json}
						maxScore={maxScore}
						onJsonChange={onJsonChange}
						onSelectScene={onSelectScene}
					/>
				)}
			</div>
		</>
	);
}
