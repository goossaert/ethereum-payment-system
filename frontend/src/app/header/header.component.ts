import { Component, Inject, Input, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {

  public isUserAuthenticated = false;
  public ethAddress = null;
  public ethAddressForDisplay = null;
  private authListenerSubs: Subscription;

  constructor(
    private _snackBar: MatSnackBar,
    private authService: AuthService,
    private ngZone: NgZone, // https://www.educative.io/edpresso/change-detection-getting-in-the-angular-zone
    ) {}

  ngOnInit() {
    this.isUserAuthenticated = this.authService.isAuthenticated();
    this.setEthAddress(this.authService.getEthAddress());
    let that = this;
    this.authListenerSubs = this.authService
      .getAuthStatusListener()
      .subscribe(ping => {
        this.ngZone.run(() => {
          that.isUserAuthenticated = ping;
          that.setEthAddress(that.authService.getEthAddress());
        });
      }
    );
  }

  openSnackBar(message: string, button: string) {
    this._snackBar.open(message, button, {
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  public setEthAddress(ethAddress: string) {
    if (!ethAddress) return;
    this.ethAddress = ethAddress;
    this.ethAddressForDisplay = `${ ethAddress.slice(0, 5) }...${ethAddress.slice(ethAddress.length - 5)}`;
  }

  public onSignIn() {
    (async () => {
      try {
        let ret = await this.authService.signInWithMetaMask();
        if (ret.status != 'success') {
          this.openSnackBar(ret.message, "OK");
        }
      } catch(e) {
        console.log(`Error: ${e.toString()}`);
      }
    })();
  }

  onSignOut() {
    this.authService.signOut();
  }

  ngOnDestroy() {
    this.authListenerSubs.unsubscribe();
  }
}