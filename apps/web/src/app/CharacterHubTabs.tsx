import {
  formatCharacterHubTabLabel,
  type CharacterHubTab
} from "./navigation";

export type CharacterHubTabsProps = {
  activeTab: CharacterHubTab;
  onTabChange: (tab: CharacterHubTab) => void;
};

export function CharacterHubTabs(props: CharacterHubTabsProps) {
  const tabs: CharacterHubTab[] = ["character", "renown", "ledger", "encyclopedia"];

  return (
    <article className="contentCard">
      <div className="profileSwitchBar">
        <div className="profileSwitchButtons characterHubSwitchButtons">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`profileSwitchButton${props.activeTab === tab ? " active" : ""}`}
              data-testid={`character-hub-tab-${tab}`}
              onClick={() => props.onTabChange(tab)}
            >
              {formatCharacterHubTabLabel(tab)}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
