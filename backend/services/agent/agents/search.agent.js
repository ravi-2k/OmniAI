import { checkAgentLimit } from "../config/agentLimit.js";
import { searchTool } from "../config/tavily.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";

export const searchAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "search");

    const results = await searchTool.invoke({
      query: state.prompt,
    });

    if (typeof results === "string" || results?.error) {
      throw new HttpError(502, "SEARCH_FAILED", "Web search failed. Please try again.");
    }

    const list = Array.isArray(results?.results) ? results.results : [];

    const images = (Array.isArray(results?.images) ? results.images : [])
      .map((image) => (typeof image === "string" ? image : image?.url))
      .filter(Boolean);

    return {
      ...state,
      // trimmed copy goes to the LLM, `sources` is returned to the client
      searchResults: list.map(({ title, url, content }) => ({
        title,
        url,
        content,
      })),
      sources: list
        .filter((result) => result?.url)
        .map((result) => ({
          title: result.title || result.url,
          url: result.url,
          snippet: String(result.content || "").slice(0, 300),
        })),
      images,
    };
  } catch (error) {
    throw toAgentError(error, "Web search failed. Please try again.");
  }
};
