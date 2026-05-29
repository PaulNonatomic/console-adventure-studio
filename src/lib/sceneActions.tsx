/**
 * Tiny React Context for scene-level actions the SceneNode
 * needs to expose. SceneNode is registered as a React Flow node
 * type at module scope (so its identity stays stable), which
 * means it can't easily take callbacks via props from App.
 * Threading callbacks via SceneNodeData would work, but
 * functions on data invalidate React Flow's change-detection
 * shallow comparison and cause spurious re-renders.
 *
 * Context is the cleanest fit: the provider lives in
 * `<AppInner>` alongside the existing React Flow + Confirm
 * providers; SceneNode consumes via `useSceneActions()`. The
 * context can grow if more node-level actions need wiring (e.g.
 * "duplicate scene", "highlight upstream") without churning
 * the node type's props.
 */
import { createContext, useContext, type ReactNode } from 'react';

export interface SceneActions {
	/**
	 * Boot the playtest at this scene. Mirrors the inline
	 * editor's `▶ play from here` button so the action is
	 * reachable straight from the graph, no card required.
	 */
	onPlayFromHere: (sceneId: string) => void;
}

const SceneActionsContext = createContext<SceneActions | null>(null);

export function SceneActionsProvider({
	value,
	children
}: {
	value: SceneActions;
	children: ReactNode;
}) {
	return (
		<SceneActionsContext.Provider value={value}>
			{children}
		</SceneActionsContext.Provider>
	);
}

/**
 * Consume scene-level actions. Returns `null` if no provider is
 * mounted -- callers should bail gracefully (don't render the
 * affordance) rather than throw, since the SceneNode component
 * might be rendered in test fixtures without the full app
 * around it.
 */
export function useSceneActions(): SceneActions | null {
	return useContext(SceneActionsContext);
}
