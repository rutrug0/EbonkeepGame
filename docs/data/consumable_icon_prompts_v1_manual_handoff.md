# Consumable Icon Manual Handoff

## Source Summary

- Source CSV: `docs/data/consumable_icon_prompts_v1.csv`
- Scope: `17` base consumables across `2` potions, `8` tonics, and `7` elixirs
- Runtime note: distilled variants reuse the base icon for now; current icon lookup normalizes `_d1` and `_d2` back to the base `icon_key`
- Pipeline output path: `apps/web/public/assets/items/generated/consumable/{potion|tonic|elixir}/{icon_key}.png`
- Processed runtime sibling: `*_p.png` at `150x150`
- Current hand-placed runtime fallback path: `apps/web/public/assets/consumables/{icon_key}.png`
- Render intent: `1024x1024`, transparent background, UI-ready isolated assets

## Locked Art Direction

- Shared render language: medium cel shading, clean ink-style linework, grounded medieval fantasy materials, transparent background, no labels, no readable text
- Potion vessel silhouette: the same short, squat apothecary vial for all potions
- Tonic vessel silhouette: the same taller field-flask silhouette for all tonics
- Elixir vessel silhouette: the same refined long-neck elixir bottle for all elixirs
- Group rule: container silhouette, glass treatment, cork/stopper, framing, and camera remain fixed within a group
- Product rule: only the liquid inside changes between consumables; do not add extra charms, tags, straps, or custom bottle shapes per item

## Manual Prompt List

### 1. Healing Potion
- icon_key: `consumable_healing_potion`
- consumable_id: `healing_potion`
- item_type: `potion`
```text
One Healing Potion only. Keep the locked potion vial silhouette unchanged. The only product-specific change is the liquid inside the glass: a dense muted crimson-red herbal liquid, slightly cloudy, with a soft pale froth line hugging the inner glass near the top and a faint darker red depth near the base. No glow, no sparks, no smoke, no label, and no attachments. The read should be practical healing liquid first.
```

### 2. Second Wind Potion
- icon_key: `consumable_second_wind_potion`
- consumable_id: `second_wind_potion`
- item_type: `potion`
```text
One Second Wind Potion only. Keep the locked potion vial silhouette unchanged. The only product-specific change is the liquid inside the glass: a clear cool teal-green liquid with lively mint-bright highlights, slight translucency, and a few very fine rising bubbles contained inside the bottle. No glow spill, no foam outside the glass, no label, and no attachments. The read should be fresh, brisk, and energizing.
```

### 3. Warden's Tonic
- icon_key: `consumable_wardens_tonic`
- consumable_id: `wardens_tonic`
- item_type: `tonic`
```text
One Warden's Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: smoky steel-blue fluid with restrained silver-grey mineral flecks and small stone-like fragments suspended within the liquid, plus a cooler blue body behind them. No labels, no charms, no extra stopper changes, and no external magical effects. The read should be disciplined, defensive, and mineral-heavy.
```

### 4. Hunter's Tonic
- icon_key: `consumable_hunters_tonic`
- consumable_id: `hunters_tonic`
- item_type: `tonic`
```text
One Hunter's Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: clear amber-gold liquid with a restrained olive tint at the edges and a few tiny bright pollen-like flecks suspended within. No labels, no straps, no extra ornament, and no outside glow. The read should suggest precision, focus, and a hunter's steady hand.
```

### 5. Emberwake Tonic
- icon_key: `consumable_emberwake_tonic`
- consumable_id: `emberwake_tonic`
- item_type: `tonic`
```text
One Emberwake Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: burnished ember-orange fluid with a deeper hot red core and a few contained ember-like streaks suspended inside the liquid itself. Any luminosity must stay fully contained within the liquid, with no spill outside the silhouette. No labels or attachments. The read should be offensive heat without turning into fire magic spectacle.
```

### 6. Berserker's Tonic
- icon_key: `consumable_berserkers_tonic`
- consumable_id: `berserkers_tonic`
- item_type: `tonic`
```text
One Berserker's Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: dark rust-red fluid cut with jagged orange ribbons and slightly active surface agitation, as if the liquid wants to keep moving even when the flask is still. No glow spill, no foam outside the bottle, no labels, and no added hardware. The read should be reckless tempo and controlled aggression.
```

### 7. Bulwark Tonic
- icon_key: `consumable_bulwark_tonic`
- consumable_id: `bulwark_tonic`
- item_type: `tonic`
```text
One Bulwark Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: a dense slate-blue liquid with a few pale stone-like shards and mineral flakes suspended inside the fluid, plus one or two broad lighter bands drifting through the body of the tonic to suggest weight and reinforcement. No labels, no chains, no added sigils, and no effects outside the glass. The read should be heavy, fortified, and weight-bearing.
```

### 8. Wardwash Tonic
- icon_key: `consumable_wardwash_tonic`
- consumable_id: `wardwash_tonic`
- item_type: `tonic`
```text
One Wardwash Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: pale aqua fluid with a faint lavender undertone and subtle circular ward-like ripples visible inside the liquid body, never outside the bottle. No labels, no extra flask detailing, and no decorative magic around it. The read should be cleansing, warded, and prepared for hostile magic.
```

### 9. Hexcleanse Tonic
- icon_key: `consumable_hexcleanse_tonic`
- consumable_id: `hexcleanse_tonic`
- item_type: `tonic`
```text
One Hexcleanse Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: milky silver-violet fluid with one darker impurity strand visibly breaking apart and dissolving within the liquid. Keep the effect contained inside the bottle, with no external smoke or magical aura. No labels or attachments. The read should be purification under pressure rather than raw destruction.
```

### 10. Ravager's Tonic
- icon_key: `consumable_ravagers_tonic`
- consumable_id: `ravagers_tonic`
- item_type: `tonic`
```text
One Ravager's Tonic only. Keep the locked tonic flask silhouette unchanged. The only product-specific change is the liquid inside the glass: dark garnet liquid with restrained copper sparks and a subtle forward-swept spiral suspended in the fluid, as if the contents are always leaning into motion. Keep all energy inside the bottle. No labels, no extra hardware, and no external effects. The read should be violent momentum and rapid engagement.
```

### 11. Sunspike Elixir
- icon_key: `consumable_sunspike_elixir`
- consumable_id: `sunspike_elixir`
- item_type: `elixir`
```text
One Sunspike Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: radiant sun-gold liquid with a brighter white-hot center line and restrained internal brilliance, never blooming beyond the silhouette. No labels, no jewelry, no extra crestwork, and no external glow. The read should be premium long-session offensive power.
```

### 12. Graveward Elixir
- icon_key: `consumable_graveward_elixir`
- consumable_id: `graveward_elixir`
- item_type: `elixir`
```text
One Graveward Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: deep moss-green fluid with iron-grey depth, slightly opaque layering, and a few grave-dust-like flecks and dark herbal fragments suspended within the liquid. No external aura, no labels, and no extra bottle ornament. The read should be durable, grave and patient, not poisonous.
```

### 13. Deadeye Elixir
- icon_key: `consumable_deadeye_elixir`
- consumable_id: `deadeye_elixir`
- item_type: `elixir`
```text
One Deadeye Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: clean yellow-green liquid with a razor-clear bright line highlight and very light precision flecks suspended in the fluid. No external glow, no labels, and no extra detailing outside the locked elixir bottle. The read should be sharp, calm, and highly accurate.
```

### 14. Traveler's Elixir
- icon_key: `consumable_travelers_elixir`
- consumable_id: `travelers_elixir`
- item_type: `elixir`
```text
One Traveler's Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: warm honey-amber liquid with a moss-green edge tint and smooth layered transparency that suggests an easy-flowing cordial. No labels, no ribbons, no route marks, and no added accessories. The read should be efficient travel and sustained movement.
```

### 15. Contractor's Resolve Elixir
- icon_key: `consumable_contractors_resolve_elixir`
- consumable_id: `contractors_resolve_elixir`
- item_type: `elixir`
```text
One Contractor's Resolve Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: coin-gold liquid with restrained metallic flecks and a richer brown-gold depth toward the base. Keep it premium but not gaudy, with no treasure spilling and no effects outside the bottle. No labels or extra ornament. The read should be profitable, disciplined, and worth planning around.
```

### 16. Chronicler's Elixir
- icon_key: `consumable_chroniclers_elixir`
- consumable_id: `chroniclers_elixir`
- item_type: `elixir`
```text
One Chronicler's Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: deep indigo liquid with ink-blue translucency and a faint pale scholar-like glow confined fully inside the fluid. No runes outside the bottle, no labels, and no extra attachments. The read should be rare study, focus, and long-session growth.
```

### 17. Warcaller's Elixir
- icon_key: `consumable_warcallers_elixir`
- consumable_id: `warcallers_elixir`
- item_type: `elixir`
```text
One Warcaller's Elixir only. Keep the locked elixir bottle silhouette unchanged. The only product-specific change is the liquid inside the glass: burning red-orange liquid with restrained brass sparks and a rolling pressure-wave shape trapped inside the fluid. Keep all energy fully contained in the bottle, with no external fire, no labels, and no additional bottle modifications. The read should be sustained pressure and battle tempo over a long session.
```
