import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div style="display:flex;flex-direction:column;height:100vh;overflow:hidden;">
      <div style="flex:1;min-height:0;overflow:hidden;">
        <router-outlet></router-outlet>
      </div>
    </div>
    <router-outlet name="popup"></router-outlet>
  `,
})
export class AppComponent {}

