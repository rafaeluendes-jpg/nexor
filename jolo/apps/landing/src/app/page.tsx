import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Opportunity } from '../components/Opportunity';
import { Differentials } from '../components/Differentials';
import { Impact } from '../components/Impact';
import { Trajectory } from '../components/Trajectory';
import { History } from '../components/History';
import { MissionVisionValues } from '../components/MissionVisionValues';
import { Products } from '../components/Products';
import { Benefits } from '../components/Benefits';
import { FranchiseJourney } from '../components/FranchiseJourney';
import { Training } from '../components/Training';
import { Profile } from '../components/Profile';
import { Investment } from '../components/Investment';
import { Partners } from '../components/Partners';
import { Faq } from '../components/Faq';
import { FinalCta } from '../components/FinalCta';
import { Footer } from '../components/Footer';
import { FloatingWhatsApp } from '../components/FloatingWhatsApp';
import { LandingRuntime } from '../components/LandingRuntime';

/** Mesma ordem de secoes da pagina aprovada. Nao reordenar sem pedido do Rafael. */
export default function Page() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Opportunity />
        <Differentials />
        <Impact />
        <Trajectory />
        <History />
        <MissionVisionValues />
        <Products />
        <Benefits />
        <FranchiseJourney />
        <Training />
        <Profile />
        <Investment />
        <Partners />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsApp />
      <LandingRuntime />
    </>
  );
}
