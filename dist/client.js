import Config from "./config.js";
import { createClient } from "@clickhouse/client";
const client = createClient({
    url: Config.clickhouseURL
});
export default client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sTUFBTSxhQUFhLENBQUM7QUFDakMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRWxELE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQztJQUN4QixHQUFHLEVBQUUsTUFBTSxDQUFDLGFBQWE7Q0FDNUIsQ0FBQyxDQUFDO0FBQ0gsZUFBZSxNQUFNLENBQUMifQ==