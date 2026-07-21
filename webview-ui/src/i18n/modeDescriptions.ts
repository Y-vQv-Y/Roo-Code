const builtInModeSlugs = new Set(["architect", "code", "ask", "debug", "orchestrator"])

type Translate = (key: string, options?: { defaultValue?: string }) => string

const translateBuiltInModeField = (t: Translate, slug: string, field: "Names" | "Descriptions", fallback = "") => {
	if (!builtInModeSlugs.has(slug)) {
		return fallback
	}

	const key = `chat:modeSelector.builtInMode${field}.${slug}`
	const translated = t(key, { defaultValue: fallback })

	return translated === key ? fallback : translated
}

export const getLocalizedModeName = (t: Translate, slug: string, fallback = ""): string =>
	translateBuiltInModeField(t, slug, "Names", fallback)

export const getLocalizedModeDescription = (t: Translate, slug: string, fallback = ""): string =>
	translateBuiltInModeField(t, slug, "Descriptions", fallback)

export const getModeDescriptionForDisplay = (
	t: Translate,
	slug: string,
	defaultDescription: string | undefined,
	customDescription?: string,
): string => {
	if (customDescription !== undefined && customDescription !== defaultDescription) {
		return customDescription
	}

	return getLocalizedModeDescription(t, slug, defaultDescription)
}
