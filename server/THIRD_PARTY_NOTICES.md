# Third-party notices

The Little Universe backend includes or depends on the following third-party
software. Their licences are reproduced here as those licences require.

---

## astronomy-engine

Used for all deterministic astronomical calculation — lunar phase and
illumination, solar and lunar ecliptic longitude, and lunar quarter search.
See `src/services/astronomy/`.

- Package: [`astronomy-engine`](https://www.npmjs.com/package/astronomy-engine)
- Project: https://github.com/cosinekitty/astronomy
- Version: 2.1.19
- Licence: MIT

```
MIT License

Copyright (c) 2019-2025 Don Cross <cosinekitty@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Other runtime dependencies

`express`, `pg`, `zod`, `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `morgan`
and `dotenv` are all MIT-licensed. Their licence texts ship inside
`node_modules/<package>/LICENSE` and are redistributed with the deployed
application.

---

## Software deliberately NOT used

Recorded so the decisions are not quietly revisited.

### Swiss Ephemeris / `pyswisseph` — NOT USED

Swiss Ephemeris is dual-licensed: **AGPL-3.0**, or a paid Swiss Ephemeris
Professional Licence. Under the AGPL, software made available over a network
must publish its complete source. Using it — directly or through a wrapper such
as `pyswisseph` — would therefore require either releasing all of The Little
Universe under the AGPL, or purchasing a commercial licence.

`astronomy-engine` (MIT) provides everything this product needs with no such
obligation.

### Tarott (`github.com/handebudak/tarott`) — NOT USED

Reviewed as a reference during the Phase 4.5 audit. Its LICENSE is a
proprietary all-rights-reserved notice: *"Copyright (c) 2025 Hande Budak. All
rights reserved… Any reproduction, distribution, commercial use, or
modification of this code or its content is strictly prohibited without the
explicit written permission of the author."*

No code, card data, prompt text or image from that project is used here. Tarot
concepts implemented in this codebase (major and minor arcana, suits, upright
and reversed meanings, one-card and three-card spreads) are long-standing
public-domain domain knowledge and were implemented independently.

### Astral Oracle (`github.com/vugarfamiloglu/astral-oracle`) — NOT USED

Apache-2.0, and reuse would have been permitted. Reviewed as architectural
inspiration only; no code was copied. It is a Python/FastAPI/SQLAlchemy
application, and this project is Node/TypeScript/Express with PostgreSQL.
