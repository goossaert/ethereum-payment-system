import { BrowserModule, Title } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRadioModule, MAT_RADIO_DEFAULT_OPTIONS } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { AuthInterceptor } from './auth/auth.interceptor';
import { MembershipComponent } from './membership/membership.component';
import { HeaderComponent } from './header/header.component';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MembershipComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    MatToolbarModule,
    MatSnackBarModule,
    MatRadioModule,
    MatIconModule,
    BrowserAnimationsModule,
  ],
  entryComponents: [
  ],
  providers: [
    {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true},
    {provide: MAT_RADIO_DEFAULT_OPTIONS, useValue: { color: 'accent' }},
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
