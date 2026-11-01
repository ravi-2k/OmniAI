import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { getMemory } from "../config/memory.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { textOf } from "../utils/llm.js";
import { toAgentError } from "../utils/agentErrors.js";

const buildSearchContext = (results) => {
  if (!Array.isArray(results)) return "";

  if (!results.length) {
    return `
        Web search returned no relevant results.
        Say that no live results were found, then answer from general knowledge if you can.
        `;
  }

  const sources = results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title || "Untitled"} (${result.url})\n${result.content || ""}`,
    )
    .join("\n\n");

  return `
        Web Search Results:

        ${sources}

        Answer the user using only the above search results.
        Cite the sources you use inline as [1], [2], etc., matching the numbers above.
        `;
};

export const chatAgent = async (state) => {
  try {
    // A search request already consumed the "search" allowance; don't charge
    // the same request against "chat" as well.
    if (!state.searchResults) {
      await checkAgentLimit(state.userId, "chat");
    }

    const llm = await getModel("chat");

    const history = await getMemory(state.conversationId, state.userId);

    const searchContext = buildSearchContext(state.searchResults);

    const systemPrompt = `
            You are OmniAI, an intelligent AI assistant.


            ${searchContext}

            If search results are provided:

        - Use search results to answer.
        - Do not mention internal tools.


            Rules:

        - For simple questions, greetings, and short queries, respond naturally in plain text.
        - For technical, educational, coding, or detailed topics, use clean Markdown.


        Formatting:

        - Use # for titles and ## for sections.
        - Leave a blank line after headings.
        - Use bullet points for lists.
        - Use numbered lists for steps.
        - Use fenced code blocks with language tags for code.
        - Keep paragraphs short and readable.
        - Never write headings and content on the same line.
        - Never generate large walls of text.
    `;
    const messages = [new SystemMessage(systemPrompt)];

    history.forEach((msg) => {
      if (msg.role == "user") {
        messages.push(new HumanMessage(msg.content));
      }
      if (msg.role == "assistant") {
        messages.push(new AIMessage(msg.content));
      }
    });

    messages.push(new HumanMessage(state.prompt));

    const response = await llm.invoke(messages);

    return {
      ...state,
      aiResponse: textOf(response),
    };
  } catch (error) {
    throw toAgentError(error, "Failed to generate a response.");
  }
};
