import type { Metadata } from "next";
import { DesignFrame } from "@/design/Design";
import { getSite } from "@/content/site";
import { Footer, Header, SiteBackground } from "@/components/SiteChrome";
import { Consent } from "@/components/Consent";

export const metadata: Metadata = {
  title: "Applying to Digital Hub",
};

export default function PrivacyCareers() {
  const site = getSite();
  return (
    <DesignFrame set="careers">
      <SiteBackground set="careers" />
      <Header site={site} set="careers" currentPath="/privacy-careers" />
      <main className="page-hub page-careers" data-page-type="page" data-design-set="careers">
        <section className="section careers-detail">
          <div className="careers-detail__inner">
            <h1>Applying to Digital Hub</h1>
            <p>When you apply through this website we receive the information you enter (name, email, phone if given, your message) and the CV you attach.</p>
            <p>We use it only to consider your application for the position you applied for or for future positions at Digital Hub.</p>
            <p>Your application is sent by email to our careers mailbox (careers@digitalhub.com.eg) and is read by our hiring team. This website does not keep your CV or your details: it only keeps a count of how many applications each position received.</p>
            <p>Your application stays in our careers mailbox until we have finished considering it and for as long as our hiring records policy allows; ask us if you want it deleted.</p>
            <p>To access, correct or delete your application, write to careers@digitalhub.com.eg.</p>
            <p>By ticking the box and sending the form you agree to this use.</p>
          </div>
        </section>
      </main>
      <Footer site={site} set="careers" currentPath="/privacy-careers" />
      <Consent settings={site.content.settings} />
    </DesignFrame>
  );
}
