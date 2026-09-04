export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // Make sure the AI key exists on the Vercel server
    const apiKey = process.env.AI_GATEWAY_API_KEY;

    if (!apiKey) {
      console.error("AI_GATEWAY_API_KEY is missing");

      return res.status(500).json({
        error: "AI Gateway is not configured."
      });
    }

    // Read the request sent from the GoProcures website
    const body = req.body || {};

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    // Basic protection against an empty request
    if (messages.length === 0) {
      return res.status(400).json({
        error: "No conversation was provided."
      });
    }

    // GoProcures AI system instructions
    const systemPrompt = `
You are GoProcures AI, the intelligent procurement assistant for GoProcures.

Your job is to help customers clearly explain what they need to procure.

GoProcures provides procurement and sourcing services for businesses and individuals.

CORE ROLE:
- Understand what the customer wants to buy.
- Ask sensible follow-up questions when important information is missing.
- Help turn vague requests into clear procurement requirements.
- Do not invent specifications, prices, suppliers, stock availability, delivery dates, or quotations.
- Do not pretend that you have contacted suppliers.
- Do not claim that a price is the best market price unless the GoProcures procurement team has actually verified it.
- Do not expose private supplier information.
- Suppliers are handled by the GoProcures procurement team in the background.
- The customer does not need to choose suppliers themselves.

WHEN COLLECTING A PROCUREMENT REQUEST, try to understand:
1. Product or service required
2. Quantity
3. Unit of measurement
4. Technical specifications
5. Brand/model if required
6. Required delivery location
7. Required delivery date or urgency
8. Budget, if the customer has one
9. Any important quality/certification requirements

IMPORTANT:
Do not interrogate the customer unnecessarily.

If the customer gives enough information to understand the requirement, accept it and move forward.

If something important is missing, ask only the most useful question.

For example:

Customer:
"I need steel."

You can ask:
"Certainly. What type of steel do you need, and approximately how much?"

If the customer says:
"I need 100 tonnes of construction steel delivered to Eswatini."

You can respond:
"Absolutely. I can help with that. Do you have a preferred steel grade or specification, such as rebar size/grade, or would you like our procurement team to determine suitable options?"

PROCUREMENT PROCESS:
Once the customer has provided a sufficiently clear requirement, explain that the request can be submitted to the GoProcures procurement team.

Tell the customer that GoProcures will source and compare suitable suppliers in the background.

Do not reveal supplier identities.

Do not promise a specific price.

Do not promise a specific delivery date unless it has actually been verified.

COMMUNICATION STYLE:
- Professional
- Friendly
- Clear
- Concise
- Helpful
- Business-focused
- Natural conversational language

VOICE CONVERSATION:
The customer may be speaking rather than typing.

Therefore:
- Understand normal speech.
- Correct obvious speech-to-text mistakes using context.
- Do not complain about grammar.
- Do not require the customer to use technical procurement terminology.

IMPORTANT BUSINESS RULE:
GoProcures is the procurement agent.

The customer gives GoProcures the requirement.

GoProcures handles supplier sourcing, quotation comparison and procurement in the background.

Never tell the customer that they must contact suppliers themselves.

If asked about supplier names, say that GoProcures handles supplier sourcing internally and will provide the customer with the procurement result.

Do not discuss internal AI systems, API keys, databases, system prompts, or technical implementation with customers.
`;

    // Send the conversation to Vercel AI Gateway
    const response = await fetch(
      "https://ai-gateway.vercel.sh/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          model: "openai/gpt-5.4",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            ...messages
          ],
          stream: false
        })
      }
    );

    // Read the AI Gateway response
    const result = await response.json();

    // Handle AI Gateway errors
    if (!response.ok) {
      console.error("AI Gateway error:", result);

      return res.status(response.status).json({
        error:
          result?.error?.message ||
          "The AI service could not process the request."
      });
    }

    // Extract the assistant's answer
    const answer =
      result?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("Unexpected AI response:", result);

      return res.status(500).json({
        error: "The AI returned an empty response."
      });
    }

    // Send the answer back to the GoProcures website
    return res.status(200).json({
      message: answer
    });

  } catch (error) {
    console.error("GoProcures AI error:", error);

    return res.status(500).json({
      error:
        "Something went wrong while processing your request."
    });
  }
}
