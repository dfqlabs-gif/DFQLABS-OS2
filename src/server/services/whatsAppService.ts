export class WhatsAppService {
  public static buildTargetUrl(phoneNormalized: string, messageText: string): string {
    const cleanPhone = phoneNormalized.replace(/\+/g, "").replace(/\s/g, "");
    const encodedText = encodeURIComponent(messageText);
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
}
