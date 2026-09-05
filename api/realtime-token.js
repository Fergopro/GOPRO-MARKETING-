import { gateway } from "@ai-sdk/gateway";

export async function POST() {
  try {
    const { token, url } =
      await gateway.experimental_realtime.getToken({
        model: "openai/gpt-realtime-2.1",
      });

    return Response.json({
      token,
      url,
    });
  } catch (error) {
    console.error("Realtime token error:", error);

    return Response.json(
      {
        error: "Unable to start GoProcures voice agent.",
      },
      {
        status: 500,
      }
    );
  }
}
