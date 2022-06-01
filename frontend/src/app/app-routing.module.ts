import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { LandingComponent } from "./landing/landing.component";
import { MembershipComponent } from "./membership/membership.component";

const routes: Routes = [
  { path: '', component: LandingComponent},
  { path: 'membership', component: MembershipComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
