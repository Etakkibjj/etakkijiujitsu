# MAT.OCHO — torneo BJJ submission only

Aplicación web responsive, pensada primero para smartphone, para organizar el **EJJ 2do Torneo Submission Only**, con dos categorías fijas: **Iniciantes** y **Avanzados**, con ocho plazas en cada una. El evento es el **sábado 7 de noviembre de 2026 a las 15 hs** en **Etakki Dojo, Ambrosetti 826, Caballito**. Todas las sumisiones son válidas para todos los niveles.

## Uso

Abre `index.html` en un navegador moderno o sirve esta carpeta desde un servidor web estático. Completa las ocho plazas de cada categoría y registra al ganador de cada combate seleccionando **Registrar victoria por sumisión**. La llave avanza automáticamente por cuartos de final, semifinales y final.

El encabezado muestra y actualiza cuántas plazas libres quedan en cada categoría. Los nombres y resultados se guardan en el almacenamiento local del navegador. La página también muestra una cuenta regresiva hasta el sábado 7 de noviembre de 2026 a las 15 hs, hora de Buenos Aires. En cada lucha puedes marcar al ganador, anotar la sumisión y, si hubo overtime, tildarlo y registrar la puntuación final. **Reiniciar resultado de esta lucha** borra el resultado y los avances posteriores que dependan de él; **Reiniciar categoría** borra la llave completa. Los datos del torneo no se transmiten a un servidor.

## Reglamento

Los torneos submission only no tienen puntos: solo se puede ganar por sumisión o rendición del oponente en tiempo reglamentario. Los combates tienen límite de tiempo de 6 minutos, con 3 minutos de tiempo extra, en donde sí habrá puntos o decisión del referí en caso de empate. El reglamento EBI recompensa la capacidad de finalizar sobre el control posicional.

La lista predeterminada de Iniciantes incluye a Gonzalo Tuñón en la plaza 6; en dispositivos con una lista guardada, una migración agrega ese nombre solo si la plaza está vacía.

Los logos de Etakki Dojo se incluyen como archivos locales en `assets/` y se usan en el encabezado, las categorías y el pie de página. Las tipografías, controles y contrastes están optimizados para facilitar la lectura desde el teléfono.
