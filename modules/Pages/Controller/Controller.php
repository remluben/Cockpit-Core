<?php

namespace Pages\Controller;

use App\Controller\App;

class Controller extends App {

    protected function before() {

        if (!$this->isAllowed('pages/manage')) {
            $this->stop(401);
        }
    }

    protected function render(string $view, array $params = []) {

        $contents = $this->app->render($view, $params);

        $view = 'pages:layouts/layout.php';
        $view .= $this->layout ? " with ".$this->layout:"";

        return $this->app->render($view, compact('contents'));
    }

}